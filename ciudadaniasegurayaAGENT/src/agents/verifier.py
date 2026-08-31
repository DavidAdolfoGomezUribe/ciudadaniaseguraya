from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
import re
from zoneinfo import ZoneInfo

from src.agents.models import AgentIncidentDraft
from src.classifiers.rule_based_classifier import RuleBasedClassifier
from src.config.constants import BOGOTA_TIMEZONE
from src.extraction.dates import IncidentDateExtractor
from src.extraction.locations import LocationExtraction, LocationExtractor
from src.models.article import ScrapedArticle
from src.scrapers.normalization import clean_text, concise_description


class DraftVerificationError(ValueError):
    def __init__(self, code: str, feedback: str) -> None:
        super().__init__(feedback)
        self.code = code
        self.feedback = feedback


@dataclass(frozen=True, slots=True)
class VerifiedAgentDraft:
    incident_type: str
    incident_type_evidence: str
    occurred_at: datetime
    temporal_basis: str
    location: LocationExtraction
    description: str
    evidence_description: str

    def as_dict(self) -> dict[str, object]:
        return {
            "accepted": True,
            "incidentType": self.incident_type,
            "incidentTypeEvidence": self.incident_type_evidence,
            "occurredAt": self.occurred_at.isoformat(),
            "temporalBasis": self.temporal_basis,
            "address": self.location.address,
            "neighborhood": self.location.neighborhood,
            "locality": self.location.locality,
        }


class AgentDraftVerifier:
    """Re-check an LLM draft exclusively with deterministic Iteration 1 tools."""

    def __init__(
        self,
        *,
        classifier: RuleBasedClassifier,
        date_extractor: IncidentDateExtractor,
        location_extractor: LocationExtractor,
        minimum_confidence: float,
        allow_publication_date_fallback: bool,
    ) -> None:
        self.classifier = classifier
        self.date_extractor = date_extractor
        self.location_extractor = location_extractor
        self.minimum_confidence = minimum_confidence
        self.allow_publication_date_fallback = allow_publication_date_fallback

    def verify(
        self,
        article: ScrapedArticle,
        draft: AgentIncidentDraft,
    ) -> VerifiedAgentDraft:
        if not draft.is_incident:
            raise DraftVerificationError(
                "agent_rejected",
                draft.rejection_reason or "The agent rejected the article.",
            )
        if draft.confidence < self.minimum_confidence:
            raise DraftVerificationError(
                "low_confidence",
                f"Confidence must be at least {self.minimum_confidence:.2f}.",
            )

        source_material = "\n".join(
            value
            for value in (
                article.title,
                article.description or "",
                article.content,
            )
            if value
        )
        evidence_fields = {"locationEvidence": draft.location_evidence}
        if draft.neighborhood is not None:
            evidence_fields["neighborhoodEvidence"] = draft.neighborhood_evidence
        if draft.occurred_at is not None:
            evidence_fields["occurredAtEvidence"] = draft.occurred_at_evidence
        if draft.locality is not None:
            evidence_fields["localityEvidence"] = draft.locality_evidence
        for field_name, evidence in evidence_fields.items():
            if not evidence or not self._supported(evidence, source_material):
                raise DraftVerificationError(
                    "unsupported_evidence",
                    f"{field_name} must be a verbatim excerpt from the article.",
                )

        if not draft.incident_type:
            raise DraftVerificationError("missing_type", "A supported incident type is required.")
        type_evidence = self._verified_type_evidence(article, draft)
        if type_evidence is None:
            raise DraftVerificationError(
                "type_mismatch",
                "No exact title or article sentence independently supports the "
                "proposed incident type with a concrete event action.",
            )
        verified_type = draft.incident_type

        if not draft.location_text:
            raise DraftVerificationError(
                "missing_location",
                "A proposed location is required.",
            )
        if draft.neighborhood is not None and not self._supported(
            draft.neighborhood, source_material
        ):
            raise DraftVerificationError(
                "unsupported_neighborhood",
                "The proposed neighborhood must be explicitly present in the article.",
            )

        location_evidence = self._evidence_bundle(
            draft.location_evidence,
            draft.neighborhood_evidence,
            draft.locality_evidence,
        )
        location = self.location_extractor.extract(location_evidence)
        if location is None:
            raise DraftVerificationError(
                "location_not_extractable",
                "Existing deterministic extraction cannot verify the proposed location.",
            )
        if (
            draft.neighborhood is not None
            and location.neighborhood is not None
            and self._fold(location.neighborhood) != self._fold(draft.neighborhood)
        ):
            raise DraftVerificationError(
                "neighborhood_mismatch",
                "Location evidence does not support the proposed neighborhood.",
            )
        if draft.locality is not None:
            if location.locality is not None and self._fold(
                location.locality
            ) != self._fold(draft.locality):
                raise DraftVerificationError(
                    "locality_mismatch",
                    "Location evidence does not support the proposed locality.",
                )

        temporal_basis = "incident_text"
        if draft.occurred_at is not None:
            if draft.occurred_at.utcoffset() is None:
                raise DraftVerificationError(
                    "naive_datetime",
                    "occurredAt must include a timezone offset.",
                )
            extracted_date = self.date_extractor.extract(
                draft.occurred_at_evidence or "",
                article.publication_date,
            )
            if extracted_date is None or (
                extracted_date.value.astimezone(UTC)
                != draft.occurred_at.astimezone(UTC)
            ):
                raise DraftVerificationError(
                    "date_mismatch",
                    "The proposed occurredAt is not supported by its exact excerpt. "
                    "If the article lacks both a complete incident date and time, set "
                    "occurredAt and occurredAtEvidence to null for deterministic "
                    "publication fallback.",
                )
            occurred_at = extracted_date.value
        elif (
            self.allow_publication_date_fallback
            and article.publication_date is not None
        ):
            occurred_at = article.publication_date.astimezone(
                ZoneInfo(BOGOTA_TIMEZONE)
            )
            temporal_basis = "publication_fallback"
        else:
            raise DraftVerificationError(
                "missing_datetime",
                "No verified incident timestamp or permitted publication fallback exists.",
            )

        if not draft.description:
            raise DraftVerificationError(
                "missing_description", "A concise incident description is required."
            )
        # The model's prose is useful as an intermediate proposal but cannot be
        # verified as reliably as its quoted evidence. Build the backend-facing
        # description only from deterministic facts accepted above.
        neighborhood_note = self._neighborhood_note(
            location.address,
            location.neighborhood,
        )
        description = concise_description(
            f"La fuente reporta un incidente de tipo {verified_type} en "
            f"{location.address}{neighborhood_note}.",
            maximum=2_000,
        )
        temporal_note = (
            "La fecha y hora explícitas del incidente están respaldadas por "
            f"«{clean_text(draft.occurred_at_evidence)}». "
            if temporal_basis == "incident_text"
            else (
                "La noticia no proporciona una fecha y hora completas del incidente; "
                "occurredAt usa la fecha de publicación de la fuente "
                f"({occurred_at.isoformat()}). "
            )
        )
        evidence_description = concise_description(
            (
                f"La evidencia verificada clasifica el hecho como {verified_type}: "
                f"«{clean_text(type_evidence)}». "
                f"{temporal_note}"
                f"Evidencia de ubicación: «{clean_text(location.evidence)}». "
                "Las coordenadas requieren geocodificación determinista y validación "
                "contra los límites de Bogotá."
            ),
            maximum=500,
        )
        return VerifiedAgentDraft(
            incident_type=verified_type,
            incident_type_evidence=type_evidence,
            occurred_at=occurred_at,
            temporal_basis=temporal_basis,
            location=location,
            description=description,
            evidence_description=evidence_description,
        )

    @staticmethod
    def _supported(value: str, source_material: str) -> bool:
        return clean_text(value).casefold() in clean_text(source_material).casefold()

    @staticmethod
    def _fold(value: str) -> str:
        return clean_text(value).casefold()

    def _verified_type_evidence(
        self,
        article: ScrapedArticle,
        draft: AgentIncidentDraft,
    ) -> str | None:
        """Resolve exact source evidence deterministically.

        Models are inconsistent at selecting a self-contained quote: they may
        return a valid but incomplete fragment such as ``homicidio`` even when
        the title or a nearby article sentence contains the complete event.
        Accept the draft type only when one exact source block independently
        classifies to that same type; never synthesize or join separate facts.
        """

        proposed = clean_text(draft.incident_type_evidence)
        source_material = "\n".join(
            value
            for value in (article.title, article.description or "", article.content)
            if value
        )
        if (
            proposed
            and self._supported(proposed, source_material)
            and self.classifier.supports_evidence_type(
                proposed,
                draft.incident_type,
            )
        ):
            return proposed

        candidates = [article.title]
        if article.description:
            candidates.append(article.description)
        candidates.extend(
            fragment
            for fragment in re.split(r"(?<=[.!?])\s+|[\r\n]+", article.content)
            if clean_text(fragment)
        )
        for candidate in candidates:
            exact = clean_text(candidate)
            if self.classifier.supports_evidence_type(exact, draft.incident_type):
                return exact
        return None

    @classmethod
    def _neighborhood_note(cls, address: str, neighborhood: str | None) -> str:
        if not neighborhood:
            return ""
        folded_neighborhood = cls._fold(neighborhood)
        address_aliases = {
            folded_neighborhood,
            f"barrio {folded_neighborhood}",
            f"barrio de {folded_neighborhood}",
        }
        if cls._fold(address) in address_aliases:
            return ""
        return f", en el barrio {neighborhood}"

    @classmethod
    def _evidence_bundle(cls, *values: str | None) -> str:
        """Combine exact excerpts without duplicating contained fragments."""

        ordered = sorted(
            dict.fromkeys(value for value in values if value),
            key=len,
            reverse=True,
        )
        selected: list[str] = []
        for value in ordered:
            folded = cls._fold(value)
            if any(folded in cls._fold(existing) for existing in selected):
                continue
            selected.append(value)
        return "\n".join(selected)
