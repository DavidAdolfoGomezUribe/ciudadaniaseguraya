from __future__ import annotations

import asyncio
import logging
from collections import deque
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import uuid4

import httpx
from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.config.settings import Settings
from src.services.factory import (
    build_agent_pipeline,
    build_backend_incident_client,
    build_collection_service,
    build_llm_provider,
)
from src.classifiers.rule_based_classifier import RuleBasedClassifier
from src.extraction.locations import LocationExtractor
from src.services.candidate_selection import prioritize_articles

logger = logging.getLogger(__name__)

ProviderName = Literal["openai", "ollama"]
ACTIVE_STATUSES = {"collecting", "analyzing", "ingesting", "cancelling"}


class StartAgentRun(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider: ProviderName
    model: str = Field(min_length=1, max_length=200)
    limit: int = Field(ge=1, le=100)
    max_articles: int = Field(default=100, alias="maxArticles", ge=1, le=100)
    ingest: bool = False
    confirm_ingest: bool = Field(default=False, alias="confirmIngest")

    @model_validator(mode="after")
    def confirmed_write(self) -> "StartAgentRun":
        self.model = self.model.strip()
        if not self.model:
            raise ValueError("model cannot be blank")
        if self.ingest and not self.confirm_ingest:
            raise ValueError("confirmIngest must be true when ingest is enabled")
        if self.max_articles < self.limit:
            raise ValueError("maxArticles must be greater than or equal to limit")
        return self


class AgentRunManager:
    """Own one auditable, operator-triggered run per service process."""

    def __init__(self, *, maximum_logs: int = 500) -> None:
        self._lock = asyncio.Lock()
        self._task: asyncio.Task[None] | None = None
        self._cancel_requested = False
        self._run: dict[str, Any] | None = None
        self._logs: deque[dict[str, str]] = deque(maxlen=maximum_logs)
        self._provider_cache: dict[str, Any] | None = None
        self._provider_cache_until = 0.0

    async def provider_status(
        self,
        settings: Settings,
        *,
        refresh: bool = False,
    ) -> dict[str, Any]:
        now = asyncio.get_running_loop().time()
        if (
            not refresh
            and self._provider_cache is not None
            and now < self._provider_cache_until
        ):
            return self._provider_cache
        ollama_models: list[str] = []
        ollama_error: str | None = None
        try:
            async with httpx.AsyncClient(
                base_url=settings.ollama_base_url,
                timeout=min(settings.request_timeout, 3.0),
            ) as client:
                response = await client.get("/api/tags")
                response.raise_for_status()
                payload = response.json()
            ollama_models = sorted(
                {
                    str(item.get("name") or item.get("model")).strip()
                    for item in payload.get("models", [])
                    if isinstance(item, dict)
                    and str(item.get("name") or item.get("model") or "").strip()
                }
            )
        except (httpx.HTTPError, ValueError, TypeError):
            ollama_error = "Ollama is not reachable"

        openai_configured = bool(
            settings.openai_api_key and settings.openai_model.strip()
        )
        openai_available = False
        openai_message: str | None = None
        if openai_configured:
            provider = None
            try:
                provider = build_llm_provider(settings, "openai")
                openai_available = await provider.is_available()
            except Exception:
                openai_available = False
            finally:
                if provider is not None:
                    await provider.aclose()
            if not openai_available:
                openai_message = (
                    "OpenAI credential or configured model could not be verified"
                )
        else:
            openai_message = "OpenAI is not configured"
        result = {
            "openai": {
                "available": openai_available,
                "defaultModel": settings.openai_model or None,
                "models": [settings.openai_model] if settings.openai_model else [],
                "message": openai_message,
            },
            "ollama": {
                "available": bool(ollama_models),
                "defaultModel": settings.ollama_model or None,
                "models": ollama_models,
                "message": ollama_error
                or (None if ollama_models else "Ollama has no installed models"),
            },
        }
        self._provider_cache = result
        self._provider_cache_until = now + 10.0
        return result

    async def snapshot(self, settings: Settings) -> dict[str, Any]:
        providers = await self.provider_status(settings)
        run = None if self._run is None else {**self._run, "logs": list(self._logs)}
        return {
            "serviceActive": True,
            "busy": bool(run and run["status"] in ACTIVE_STATUSES),
            "providers": providers,
            "run": run,
        }

    async def start(self, request: StartAgentRun, settings: Settings) -> dict[str, Any]:
        providers = await self.provider_status(settings, refresh=True)
        selected = providers[request.provider]
        if not selected["available"]:
            raise ValueError(selected["message"] or "Selected provider is unavailable")
        if request.model not in selected["models"]:
            raise ValueError("Selected model is not available from the provider")
        async with self._lock:
            if self._task is not None and not self._task.done():
                raise RuntimeError("An agent run is already active")
            run_id = uuid4().hex
            now = self._timestamp()
            self._cancel_requested = False
            self._logs.clear()
            self._run = {
                "id": run_id,
                "status": "collecting",
                "provider": request.provider,
                "model": request.model,
                "limit": request.limit,
                "maxArticles": request.max_articles,
                "ingest": request.ingest,
                "startedAt": now,
                "finishedAt": None,
                "collection": None,
                "analysis": None,
                "acceptedPayloads": [],
                "ingestionReceipts": [],
                "ingestionFailures": 0,
                "error": None,
            }
            self._log(
                "info",
                f"Run {run_id} approved: target {request.limit} validated incidents "
                f"from at most {request.max_articles} articles with "
                f"{request.provider}/{request.model}; backend ingestion "
                f"{'enabled' if request.ingest else 'disabled'}.",
            )
            self._task = asyncio.create_task(
                self._execute(run_id, request, settings),
                name=f"agent-run-{run_id}",
            )
            return {**self._run, "logs": list(self._logs)}

    async def cancel(self, run_id: str) -> dict[str, Any]:
        async with self._lock:
            if self._run is None or self._run["id"] != run_id:
                raise LookupError("Agent run was not found")
            if self._run["status"] not in ACTIVE_STATUSES:
                raise RuntimeError("Agent run is not active")
            self._cancel_requested = True
            self._run["status"] = "cancelling"
            self._log("warning", "Cancellation requested; the current safe step will finish.")
            return {**self._run, "logs": list(self._logs)}

    async def _execute(
        self,
        run_id: str,
        request: StartAgentRun,
        settings: Settings,
    ) -> None:
        try:
            runtime_settings = settings.model_copy(
                update={
                    "llm_provider": request.provider,
                    f"{request.provider}_model": request.model,
                }
            )
            provider = build_llm_provider(runtime_settings, request.provider)
            try:
                if not await provider.is_available():
                    raise RuntimeError(
                        f"{request.provider} model {request.model!r} could not be verified"
                    )
            finally:
                await provider.aclose()
            self._log("info", "Provider credential and model preflight succeeded.")
            self._log("info", "Discovering and normalizing news from configured sources.")

            def collection_progress(event: dict[str, Any]) -> None:
                self._log(
                    "info",
                    f"Collected {event['index']}/{event['total']} [{event['source']}]: "
                    f"{event['title']}",
                )

            async with build_collection_service(runtime_settings) as collector:
                collected = await collector.collect(
                    limit=request.max_articles,
                    on_progress=collection_progress,
                    should_cancel=lambda: self._cancel_requested,
                )
            selection = prioritize_articles(
                collected.articles,
                classifier=RuleBasedClassifier(runtime_settings.incident_types),
                location_extractor=LocationExtractor(),
                maximum_age_days=runtime_settings.article_max_age_days,
            )
            collection_stats = {
                **collected.stats.as_dict(),
                "eligibleArticles": len(selection.articles),
                "staleArticles": selection.stale_articles,
            }
            self._run_or_raise(run_id)["collection"] = collection_stats
            self._log(
                "info",
                f"Collection finished with {len(collected.articles)} article(s).",
            )
            if self._cancel_requested:
                self._finish_cancelled(run_id)
                return
            if not selection.articles:
                raise RuntimeError("No readable articles were collected")

            run = self._run_or_raise(run_id)
            run["status"] = "analyzing"
            self._log("info", "Incident analysis and deterministic verification started.")
            self._log(
                "info",
                f"Prioritized {len(selection.articles)} eligible article(s); "
                f"{selection.stale_articles} stale article(s) excluded.",
            )

            def progress(event: dict[str, Any]) -> None:
                decision = str(event["decision"]).split(":", 1)[0]
                self._log(
                    "info",
                    f"Analyzed {event['index']}/{event['total']} [{event['source']}]: "
                    f"{decision} — {event['title']}",
                )

            async with build_agent_pipeline(
                runtime_settings, provider=request.provider
            ) as pipeline:
                analyzed = await pipeline.run(
                    selection.articles,
                    on_progress=progress,
                    should_cancel=lambda: self._cancel_requested,
                    target_incidents=(
                        request.limit
                        if request.limit <= len(selection.articles)
                        else None
                    ),
                )
            run = self._run_or_raise(run_id)
            run["analysis"] = {
                **analyzed.stats.as_dict(),
                "trajectoryRunId": analyzed.run_id,
                "trajectoryPath": str(analyzed.trajectory_path),
            }
            run["acceptedPayloads"] = [
                candidate.model_dump(mode="json", by_alias=True)
                for candidate in analyzed.incidents
            ]
            self._log(
                "info",
                f"Analysis finished: {len(analyzed.incidents)} validated incident(s).",
            )
            if self._cancel_requested:
                self._finish_cancelled(run_id)
                return

            if request.ingest and analyzed.incidents:
                run["status"] = "ingesting"
                self._log(
                    "warning",
                    "Submitting approved candidates to the backend without POST retries.",
                )
                client = build_backend_incident_client(runtime_settings)
                async with client:
                    for index, candidate in enumerate(analyzed.incidents, start=1):
                        if self._cancel_requested:
                            self._finish_cancelled(run_id)
                            return
                        try:
                            receipt = await client.submit(candidate)
                        except Exception as exc:
                            run["ingestionFailures"] += 1
                            self._log(
                                "error",
                                f"Backend submission {index} failed: {self._safe_error(exc)}",
                            )
                            continue
                        run["ingestionReceipts"].append(
                            {
                                "incidentId": receipt.incident_id,
                                "status": receipt.status,
                                "submissionSource": receipt.submission_source,
                                "requestId": receipt.request_id,
                            }
                        )
                        self._log(
                            "info",
                            f"Backend accepted incident {index}: {receipt.incident_id}.",
                        )

            if run["ingestionFailures"]:
                run["status"] = "completed_with_errors"
            elif len(analyzed.incidents) < request.limit:
                run["status"] = "completed_partial"
                self._log(
                    "warning",
                    f"Target not reached: {len(analyzed.incidents)}/"
                    f"{request.limit} validated incidents.",
                )
            else:
                run["status"] = "completed"
            run["finishedAt"] = self._timestamp()
            self._log("info", "Run completed.")
        except Exception as exc:
            logger.exception("Controlled agent run %s failed", run_id)
            run = self._run
            if run is not None and run.get("id") == run_id:
                run["status"] = "failed"
                run["finishedAt"] = self._timestamp()
                run["error"] = self._safe_error(exc)
                self._log("error", f"Run failed safely: {run['error']}")

    def _finish_cancelled(self, run_id: str) -> None:
        run = self._run_or_raise(run_id)
        run["status"] = "cancelled"
        run["finishedAt"] = self._timestamp()
        self._log("warning", "Run cancelled by the operator.")

    def _run_or_raise(self, run_id: str) -> dict[str, Any]:
        if self._run is None or self._run.get("id") != run_id:
            raise RuntimeError("The active run state was replaced")
        return self._run

    def _log(self, level: str, message: str) -> None:
        self._logs.append(
            {"timestamp": self._timestamp(), "level": level, "message": message}
        )

    @staticmethod
    def _timestamp() -> str:
        return datetime.now(UTC).isoformat().replace("+00:00", "Z")

    @staticmethod
    def _safe_error(exc: Exception) -> str:
        return (str(exc).strip() or exc.__class__.__name__)[:500]
