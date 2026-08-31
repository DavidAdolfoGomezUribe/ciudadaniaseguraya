from __future__ import annotations

import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from collections.abc import Callable
from typing import Any
from zoneinfo import ZoneInfo

from pydantic import ValidationError

from src.agents.incident_analysis_agent import IncidentAnalysisAgent
from src.agents.models import AgentIncidentDraft, TrajectoryRecord
from src.agents.prompts.incident_analysis_v3 import PROMPT_VERSION
from src.agents.trajectory import TrajectoryRecorder, create_run_id
from src.agents.verifier import AgentDraftVerifier, DraftVerificationError
from src.config.constants import BOGOTA_TIMEZONE
from src.config.settings import Settings
from src.geolocation.base import Geocoder
from src.llm.base import ProviderResponseError, ProviderUnavailableError, ProviderUsage
from src.models.article import ScrapedArticle
from src.models.incident import IncidentCandidate
from src.services.news_pipeline import AcceptedIncident


@dataclass(slots=True)
class AgentPipelineStats:
    total_articles: int = 0
    accepted_incidents: int = 0
    rejected_articles: int = 0
    validation_failures: int = 0
    geocoding_failures: int = 0
    agent_retries: int = 0
    provider_errors: int = 0
    agent_rejections: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    execution_time: float = 0.0

    def as_dict(self) -> dict[str, Any]:
        return {
            "totalArticles": self.total_articles,
            "acceptedIncidents": self.accepted_incidents,
            "rejectedArticles": self.rejected_articles,
            "validationFailures": self.validation_failures,
            "geocodingFailures": self.geocoding_failures,
            "agentRetries": self.agent_retries,
            "providerErrors": self.provider_errors,
            "agentRejections": self.agent_rejections,
            "inputTokens": self.input_tokens,
            "outputTokens": self.output_tokens,
            "executionTimeSeconds": round(self.execution_time, 3),
            "apiCost": None,
        }


@dataclass(slots=True)
class AgentPipelineResult:
    accepted: list[AcceptedIncident]
    stats: AgentPipelineStats
    run_id: str
    trajectory_path: Path

    @property
    def incidents(self) -> list[IncidentCandidate]:
        return [item.candidate for item in self.accepted]


class AgentPipeline:
    def __init__(
        self,
        *,
        settings: Settings,
        agent: IncidentAnalysisAgent,
        verifier: AgentDraftVerifier,
        geocoder: Geocoder,
        recorder: TrajectoryRecorder | None = None,
    ) -> None:
        self.settings = settings
        self.agent = agent
        self.verifier = verifier
        self.geocoder = geocoder
        run_id = create_run_id(agent.provider.name)
        self.recorder = recorder or TrajectoryRecorder(
            directory=settings.trajectories_path,
            run_id=run_id,
        )

    async def __aenter__(self) -> "AgentPipeline":
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        await self.agent.aclose()
        await self.geocoder.aclose()

    async def run(
        self,
        articles: list[ScrapedArticle],
        *,
        on_progress: Callable[[dict[str, Any]], None] | None = None,
        should_cancel: Callable[[], bool] | None = None,
        target_incidents: int | None = None,
    ) -> AgentPipelineResult:
        if not 1 <= len(articles) <= self.settings.max_collection_limit:
            raise ValueError(
                f"agent input must contain 1..{self.settings.max_collection_limit} articles"
            )
        if not await self.agent.provider.is_available():
            raise ProviderUnavailableError(
                f"{self.agent.provider.name} model {self.agent.provider.model!r} "
                "is not available"
            )
        if target_incidents is not None and not 1 <= target_incidents <= len(articles):
            raise ValueError("target_incidents must be within the supplied article count")
        started = time.monotonic()
        stats = AgentPipelineStats()
        accepted: list[AcceptedIncident] = []
        for index, article in enumerate(articles, start=1):
            if should_cancel is not None and should_cancel():
                break
            item, decision = await self._process_article(article, stats)
            stats.total_articles += 1
            if item is not None:
                accepted.append(item)
            if on_progress is not None:
                on_progress(
                    {
                        "index": index,
                        "total": len(articles),
                        "source": article.source,
                        "title": article.title,
                        "accepted": item is not None,
                        "decision": decision,
                    }
                )
            if target_incidents is not None and len(accepted) >= target_incidents:
                break
        stats.accepted_incidents = len(accepted)
        stats.rejected_articles = stats.total_articles - len(accepted)
        stats.execution_time = time.monotonic() - started
        return AgentPipelineResult(
            accepted=accepted,
            stats=stats,
            run_id=self.recorder.run_id,
            trajectory_path=self.recorder.path,
        )

    async def _process_article(
        self,
        article: ScrapedArticle,
        stats: AgentPipelineStats,
    ) -> tuple[AcceptedIncident | None, str]:
        started = time.monotonic()
        first_output: AgentIncidentDraft | None = None
        retry_output: AgentIncidentDraft | None = None
        retry_feedback: str | None = None
        verifier_result: dict[str, object] | None = None
        geocoder_result: dict[str, object] | None = None
        final_decision = "rejected"
        usage_input = 0
        usage_output = 0
        accepted_item: AcceptedIncident | None = None

        for attempt in range(self.settings.agent_max_retries + 1):
            try:
                response = await self.agent.analyze(
                    article,
                    feedback=retry_feedback if attempt else None,
                )
            except ProviderUnavailableError:
                raise
            except ProviderResponseError as exc:
                stats.provider_errors += 1
                if exc.usage is not None:
                    self._add_usage(stats, exc.usage)
                    usage_input += exc.usage.input_tokens or 0
                    usage_output += exc.usage.output_tokens or 0
                final_decision = f"provider_error: {exc}"
                break
            self._add_usage(stats, response.usage)
            usage_input += response.usage.input_tokens or 0
            usage_output += response.usage.output_tokens or 0
            draft = response.output
            if attempt == 0:
                first_output = draft
            else:
                retry_output = draft

            if not draft.is_incident:
                stats.agent_rejections += 1
                final_decision = f"agent_rejected: {draft.rejection_reason}"
                verifier_result = {
                    "accepted": False,
                    "reason": draft.rejection_reason or "agent rejected article",
                }
                break

            try:
                verified = self.verifier.verify(article, draft)
                verifier_result = verified.as_dict()
            except DraftVerificationError as exc:
                stats.validation_failures += 1
                verifier_result = {
                    "accepted": False,
                    "code": exc.code,
                    "feedback": exc.feedback,
                }
                if attempt < self.settings.agent_max_retries:
                    retry_feedback = exc.feedback
                    stats.agent_retries += 1
                    continue
                final_decision = f"verification_rejected: {exc.code}"
                break

            try:
                geocoded = await self.geocoder.geocode(verified.location)
            except Exception as exc:
                geocoded = None
                geocode_feedback = (
                    "The deterministic geocoder failed for the proposed location; "
                    "select a more precise location supported by the article."
                )
                geocoder_result = {"accepted": False, "error": exc.__class__.__name__}
            else:
                geocode_feedback = (
                    "The deterministic geocoder found no coherent Bogotá result; "
                    "select a more precise location supported by the article."
                )

            if geocoded is None:
                stats.geocoding_failures += 1
                geocoder_result = geocoder_result or {
                    "accepted": False,
                    "error": "no coherent Bogotá result",
                }
                if attempt < self.settings.agent_max_retries:
                    retry_feedback = geocode_feedback
                    stats.agent_retries += 1
                    continue
                final_decision = "geocoding_rejected"
                break

            geocoder_result = {
                "accepted": True,
                "latitude": geocoded.latitude,
                "longitude": geocoded.longitude,
                "displayName": geocoded.display_name,
                "matchedQuery": geocoded.matched_query,
            }
            try:
                candidate = IncidentCandidate(
                    city_id=self.settings.bogota_city_id,
                    incident_type=verified.incident_type,
                    title=self._backend_title(article.title),
                    description=verified.description,
                    occurred_at=verified.occurred_at,
                    latitude=geocoded.latitude,
                    longitude=geocoded.longitude,
                    address=verified.location.address,
                    location_precision="approximate",
                    neighborhood=verified.location.neighborhood,
                    source_url=article.url,
                    evidence_description=verified.evidence_description,
                    confirm_location=True,
                )
            except ValidationError as exc:
                stats.validation_failures += 1
                final_decision = "payload_validation_rejected"
                verifier_result = {
                    "accepted": False,
                    "code": "payload_validation",
                    "feedback": str(exc)[:500],
                }
                break
            accepted_item = AcceptedIncident(article=article, candidate=candidate)
            final_decision = "accepted"
            break

        self.recorder.record(
            TrajectoryRecord(
                run_id=self.recorder.run_id,
                timestamp=datetime.now(ZoneInfo(BOGOTA_TIMEZONE)),
                provider=self.agent.provider.name,
                model=self.agent.provider.model,
                article_source=article.source,
                article_url=article.url,
                prompt_version=PROMPT_VERSION,
                agent_structured_output=(
                    first_output.model_dump(mode="json", by_alias=True)
                    if first_output
                    else None
                ),
                verifier_result=verifier_result,
                geocoder_result=geocoder_result,
                retry_feedback=retry_feedback,
                retry_output=(
                    retry_output.model_dump(mode="json", by_alias=True)
                    if retry_output
                    else None
                ),
                final_decision=final_decision,
                execution_time_seconds=time.monotonic() - started,
                input_tokens=usage_input or None,
                output_tokens=usage_output or None,
            )
        )
        return accepted_item, final_decision

    @staticmethod
    def _add_usage(stats: AgentPipelineStats, usage: ProviderUsage) -> None:
        stats.input_tokens += usage.input_tokens or 0
        stats.output_tokens += usage.output_tokens or 0

    @staticmethod
    def _backend_title(value: str, *, maximum_units: int = 120) -> str:
        if len(value.encode("utf-16-le")) // 2 <= maximum_units:
            return value
        output: list[str] = []
        used = 0
        for character in value:
            units = len(character.encode("utf-16-le")) // 2
            if used + units > maximum_units - 1:
                break
            output.append(character)
            used += units
        return "".join(output).rstrip() + "…"
