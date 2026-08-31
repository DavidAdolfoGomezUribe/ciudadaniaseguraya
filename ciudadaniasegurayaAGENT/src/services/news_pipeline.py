import logging
import time
from collections import Counter
from dataclasses import dataclass, field, replace
from zoneinfo import ZoneInfo
from typing import Any

from pydantic import ValidationError

from src.classifiers.rule_based_classifier import RuleBasedClassifier
from src.config.settings import Settings
from src.config.constants import BOGOTA_TIMEZONE
from src.extraction.dates import DateExtraction, IncidentDateExtractor
from src.extraction.locations import LocationExtraction, LocationExtractor
from src.geolocation.base import Geocoder
from src.models.article import ArticleReference, ScrapedArticle
from src.models.incident import IncidentCandidate
from src.scrapers.http import RespectfulHttpClient
from src.scrapers.normalization import (
    canonicalize_url,
    clean_text,
    concise_description,
    title_fingerprint,
)
from src.sources.base import BaseNewsSource

logger = logging.getLogger(__name__)

NO_INCIDENT_TYPE = "no incident type"
NO_INCIDENT_DATE = "no incident date"
INSUFFICIENT_LOCATION = "insufficient location"
GEOCODING_FAILED = "geocoding failed"
DUPLICATE = "duplicate"
ARTICLE_ERROR = "article parsing failed"
VALIDATION_FAILED = "payload validation failed"

SUMMARY_REASON_ORDER = (
    NO_INCIDENT_TYPE,
    NO_INCIDENT_DATE,
    INSUFFICIENT_LOCATION,
    GEOCODING_FAILED,
    DUPLICATE,
    ARTICLE_ERROR,
    VALIDATION_FAILED,
)


@dataclass(slots=True)
class AcceptedIncident:
    article: ScrapedArticle
    candidate: IncidentCandidate


@dataclass(frozen=True, slots=True)
class _EventEvidence:
    incident_type: str
    date: DateExtraction
    location: LocationExtraction
    source_text: str


@dataclass(slots=True)
class PipelineStats:
    sources_checked: int = 0
    articles_discovered: int = 0
    articles_processed: int = 0
    articles_rejected: int = 0
    valid_incidents: int = 0
    execution_time: float = 0.0
    rejected_reasons: Counter[str] = field(default_factory=Counter)
    source_errors: dict[str, str] = field(default_factory=dict)

    def reject(self, reason: str) -> None:
        self.articles_rejected += 1
        self.rejected_reasons[reason] += 1

    def as_dict(self) -> dict[str, Any]:
        return {
            "sourcesChecked": self.sources_checked,
            "articlesDiscovered": self.articles_discovered,
            "articlesProcessed": self.articles_processed,
            "articlesRejected": self.articles_rejected,
            "validIncidents": self.valid_incidents,
            "executionTimeSeconds": round(self.execution_time, 3),
            "rejectedReasons": dict(self.rejected_reasons),
            "sourceErrors": self.source_errors,
        }


@dataclass(slots=True)
class PipelineResult:
    accepted: list[AcceptedIncident]
    stats: PipelineStats

    @property
    def incidents(self) -> list[IncidentCandidate]:
        return [item.candidate for item in self.accepted]


class InsufficientIncidentsError(RuntimeError):
    def __init__(self, requested: int, result: PipelineResult) -> None:
        super().__init__(
            f"Only {len(result.accepted)} of {requested} fully validated incidents were found"
        )
        self.requested = requested
        self.result = result


class NewsPipeline:
    """Source-agnostic deterministic transformation pipeline."""

    def __init__(
        self,
        *,
        settings: Settings,
        client: RespectfulHttpClient,
        sources: list[BaseNewsSource],
        classifier: RuleBasedClassifier,
        date_extractor: IncidentDateExtractor,
        location_extractor: LocationExtractor,
        geocoder: Geocoder,
    ) -> None:
        self.settings = settings
        self.client = client
        self.sources = sources
        self.classifier = classifier
        self.date_extractor = date_extractor
        self.location_extractor = location_extractor
        self.geocoder = geocoder

    async def __aenter__(self) -> "NewsPipeline":
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        await self.geocoder.aclose()
        await self.client.aclose()

    async def run(self, *, limit: int) -> PipelineResult:
        if not 1 <= limit <= self.settings.maximum_result_limit:
            raise ValueError(
                f"limit must be between 1 and {self.settings.maximum_result_limit}"
            )

        started = time.monotonic()
        stats = PipelineStats(sources_checked=len(self.sources))
        accepted: list[AcceptedIncident] = []
        seen_urls: set[str] = set()
        seen_titles: set[str] = set()
        iterators = {source: source.discover().__aiter__() for source in self.sources}

        try:
            while iterators and len(accepted) < limit:
                made_progress = False
                for source in list(iterators):
                    if len(accepted) >= limit:
                        break
                    if stats.articles_processed >= self.settings.maximum_articles_processed:
                        logger.warning("Maximum processed-article budget reached")
                        iterators.clear()
                        break

                    try:
                        reference = await anext(iterators[source])
                    except StopAsyncIteration:
                        iterators.pop(source, None)
                        continue
                    except Exception as exc:  # source isolation is intentional
                        logger.exception("Source %s became unavailable", source.name)
                        stats.source_errors[source.name] = self._safe_error(exc)
                        iterators.pop(source, None)
                        continue

                    made_progress = True
                    stats.articles_discovered += 1
                    reference_url = canonicalize_url(str(reference.url))
                    reference_title_hash = title_fingerprint(reference.title)
                    if reference_url in seen_urls or reference_title_hash in seen_titles:
                        stats.reject(DUPLICATE)
                        continue
                    seen_urls.add(reference_url)
                    seen_titles.add(reference_title_hash)

                    if not self.classifier.might_be_incident(
                        reference.title, reference.description
                    ):
                        stats.reject(NO_INCIDENT_TYPE)
                        continue

                    stats.articles_processed += 1
                    try:
                        item = await self._process_reference(
                            source=source,
                            reference=reference,
                            stats=stats,
                            seen_urls=seen_urls,
                            seen_titles=seen_titles,
                        )
                    except Exception as exc:  # one malformed article is isolated
                        logger.exception(
                            "Article rejected after an unexpected processing error"
                        )
                        stats.reject(ARTICLE_ERROR)
                        continue
                    if item is not None:
                        accepted.append(item)
                        stats.valid_incidents = len(accepted)
                        logger.info(
                            "Article accepted (%s/%s): %s",
                            len(accepted),
                            limit,
                            item.article.title,
                        )

                if not made_progress and iterators:
                    break
        finally:
            stats.execution_time = time.monotonic() - started

        return PipelineResult(accepted=accepted, stats=stats)

    async def _process_reference(
        self,
        *,
        source: BaseNewsSource,
        reference: ArticleReference,
        stats: PipelineStats,
        seen_urls: set[str],
        seen_titles: set[str],
    ) -> AcceptedIncident | None:
        try:
            article = await source.fetch_article(reference)
        except Exception as exc:
            logger.warning("Article rejected: parsing failed (%s)", self._safe_error(exc))
            stats.reject(ARTICLE_ERROR)
            return None

        canonical = canonicalize_url(str(article.url))
        fingerprint = title_fingerprint(article.title)
        reference_canonical = canonicalize_url(str(reference.url))
        reference_fingerprint = title_fingerprint(reference.title)
        if (
            (canonical != reference_canonical and canonical in seen_urls)
            or (
                fingerprint != reference_fingerprint
                and fingerprint in seen_titles
            )
        ):
            stats.reject(DUPLICATE)
            return None
        seen_urls.add(canonical)
        seen_titles.add(fingerprint)

        primary_incident_type = self.classifier.classify(
            article.title, article.description, article.content
        )
        if primary_incident_type is None:
            logger.info("Article rejected: missing allowed incident type")
            stats.reject(NO_INCIDENT_TYPE)
            return None

        event, rejection_reason = self._extract_event_evidence(
            article,
            required_type=primary_incident_type,
        )
        if event is None:
            logger.info("Article rejected: %s", rejection_reason)
            stats.reject(rejection_reason)
            return None

        try:
            geocoded = await self.geocoder.geocode(event.location)
        except Exception as exc:
            logger.warning("Article rejected: geocoder error (%s)", self._safe_error(exc))
            stats.reject(GEOCODING_FAILED)
            return None
        if geocoded is None:
            logger.info("Article rejected: no coherent Bogotá geocoding result")
            stats.reject(GEOCODING_FAILED)
            return None

        # The article subtitle may describe statistics or a broader operation
        # while only one paragraph reports the accepted incident. Use that
        # same compact source paragraph so the payload description cannot
        # drift away from the type, date and location that were validated.
        description = concise_description(event.source_text, maximum=600)
        if event.date.basis == "publication_fallback":
            temporal_evidence = (
                "La nota no informa una fecha y hora completas del hecho; "
                "occurredAt usa como referencia la fecha y hora de publicación "
                f"declarada por la fuente ({event.date.value.isoformat()}). "
            )
        else:
            temporal_evidence = (
                f"La fecha y hora del hecho constan en "
                f"«{clean_text(event.date.evidence)}». "
            )
        evidence = concise_description(
            (
                f"{article.source} describe un hecho clasificado como "
                f"{event.incident_type}. "
                f"{temporal_evidence}"
                f"La ubicación consta en «{clean_text(event.location.evidence)}». "
                "Las coordenadas aproximadas se obtuvieron geocodificando esa referencia "
                "y validando el resultado dentro de Bogotá."
            ),
            maximum=500,
        )

        try:
            candidate = IncidentCandidate(
                city_id=self.settings.bogota_city_id,
                incident_type=event.incident_type,
                title=article.title,
                description=description,
                occurred_at=event.date.value,
                latitude=geocoded.latitude,
                longitude=geocoded.longitude,
                address=event.location.address,
                location_precision="approximate",
                neighborhood=event.location.neighborhood,
                source_url=article.url,
                evidence_description=evidence,
                confirm_location=True,
            )
        except ValidationError as exc:
            logger.warning("Article rejected: payload validation failed (%s)", exc)
            stats.reject(VALIDATION_FAILED)
            return None
        return AcceptedIncident(article=article, candidate=candidate)

    def _extract_event_evidence(
        self,
        article: ScrapedArticle,
        *,
        required_type: str,
    ) -> tuple[_EventEvidence | None, str]:
        """Find type, timestamp and place in one compact source paragraph.

        Processing each source field and paragraph independently prevents an
        editorial date, a capture and an unrelated address from being combined
        into a synthetic event. Description is a final fallback; title is not
        used for temporal extraction.
        """

        blocks = [
            clean_text(block)
            for block in article.content.splitlines()
            if clean_text(block)
        ]
        if article.description:
            description = clean_text(article.description)
            if description and description not in blocks:
                blocks.append(description)

        saw_timestamp = False
        saw_linked_event = False
        for block in blocks:
            date = self.date_extractor.extract(block, article.publication_date)
            if date is None:
                continue
            saw_timestamp = True

            evidence_type = self.classifier.classify_evidence(date.evidence)
            if evidence_type is None and date.evidence != block:
                evidence_type = self.classifier.classify_evidence(block)
            if evidence_type != required_type:
                continue
            saw_linked_event = True

            location = self.location_extractor.extract(block)
            if location is None:
                continue
            location = self._add_title_locality(article, location)
            return (
                _EventEvidence(
                    incident_type=evidence_type,
                    date=date,
                    location=location,
                    source_text=block,
                ),
                "",
            )

        if (
            self.settings.allow_publication_date_fallback
            and article.publication_date is not None
        ):
            publication = article.publication_date.astimezone(
                ZoneInfo(BOGOTA_TIMEZONE)
            )
            for block in blocks:
                evidence_type = self.classifier.classify_evidence(block)
                if evidence_type != required_type:
                    continue
                location = self.location_extractor.extract(block)
                if location is None:
                    continue
                location = self._add_title_locality(article, location)
                return (
                    _EventEvidence(
                        incident_type=evidence_type,
                        date=DateExtraction(
                            value=publication,
                            evidence=(
                                f"Fecha de publicación declarada por "
                                f"{article.source}: {publication.isoformat()}"
                            ),
                            basis="publication_fallback",
                        ),
                        location=location,
                        source_text=block,
                    ),
                    "",
                )

        if saw_linked_event:
            return None, INSUFFICIENT_LOCATION
        if saw_timestamp:
            return None, NO_INCIDENT_DATE
        return None, NO_INCIDENT_DATE

    def _add_title_locality(
        self,
        article: ScrapedArticle,
        location: LocationExtraction,
    ) -> LocationExtraction:
        if location.locality is not None:
            return location
        context = self.location_extractor.contextual_locality(article.title)
        if context is None:
            return location
        locality, evidence = context
        if clean_text(locality).casefold() == clean_text(
            location.neighborhood
        ).casefold() and "localidad" not in evidence.casefold():
            return location
        return replace(
            location,
            locality=locality,
            evidence=f"{location.evidence}; {evidence} (título)",
        )

    @staticmethod
    def _safe_error(exc: Exception) -> str:
        return clean_text(str(exc))[:300] or exc.__class__.__name__
