from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal
from urllib.parse import urlparse

import httpx
from pydantic import BaseModel, ConfigDict, Field, SecretStr, ValidationError

from src.models.incident import IncidentCandidate


class BackendIngestError(RuntimeError):
    """Safe backend error that never contains the ingest credential."""

    def __init__(self, message: str, *, status_code: int | None = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class _CreatedIncident(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(pattern=r"^[0-9a-fA-F]{24}$")
    status: Literal["pending"]
    submission_source: Literal["ai_scraper"] = Field(alias="submissionSource")


class _SuccessEnvelope(BaseModel):
    model_config = ConfigDict(extra="ignore")

    success: Literal[True]
    data: _CreatedIncident
    meta: dict[str, Any] = Field(default_factory=dict)


@dataclass(frozen=True, slots=True)
class BackendIngestReceipt:
    incident_id: str
    status: str
    submission_source: str
    request_id: str | None


class BackendIncidentClient:
    """Submit already validated candidates without automatic POST retries."""

    def __init__(
        self,
        *,
        url: str,
        api_key: SecretStr | str | None,
        timeout: float,
        client: httpx.AsyncClient | None = None,
    ) -> None:
        normalized_url = url.strip().rstrip("/")
        secret = (
            api_key.get_secret_value()
            if isinstance(api_key, SecretStr)
            else str(api_key or "")
        )
        if not normalized_url:
            raise ValueError("AI_INGEST_URL must be configured")
        parsed = urlparse(normalized_url)
        local_hosts = {"backend", "localhost", "127.0.0.1", "::1"}
        if parsed.scheme != "https" and not (
            parsed.scheme == "http" and parsed.hostname in local_hosts
        ):
            raise ValueError(
                "AI_INGEST_URL must use HTTPS, except on the local Docker network"
            )
        if not secret:
            raise ValueError("AI_INGEST_API_KEY must be configured")
        self.url = normalized_url
        self._api_key = secret
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=False,
        )

    async def __aenter__(self) -> "BackendIncidentClient":
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.aclose()

    async def submit(self, candidate: IncidentCandidate) -> BackendIngestReceipt:
        payload = candidate.model_dump(mode="json", by_alias=True, exclude_none=True)
        try:
            response = await self._client.post(
                self.url,
                headers={"X-AI-Ingest-Key": self._api_key},
                json=payload,
            )
        except httpx.HTTPError as exc:
            raise BackendIngestError(
                f"Backend request failed before a confirmed response: {exc.__class__.__name__}"
            ) from exc

        if response.status_code != 201:
            code, message = self._safe_backend_error(response)
            raise BackendIngestError(
                f"Backend rejected incident ({code}): {message}",
                status_code=response.status_code,
            )
        try:
            envelope = _SuccessEnvelope.model_validate(response.json())
        except (ValueError, ValidationError) as exc:
            raise BackendIngestError(
                "Backend returned 201 with an unexpected response body",
                status_code=201,
            ) from exc
        request_id = envelope.meta.get("requestId")
        return BackendIngestReceipt(
            incident_id=envelope.data.id,
            status=envelope.data.status,
            submission_source=envelope.data.submission_source,
            request_id=request_id if isinstance(request_id, str) else None,
        )

    @staticmethod
    def _safe_backend_error(response: httpx.Response) -> tuple[str, str]:
        try:
            payload = response.json()
        except ValueError:
            return f"HTTP_{response.status_code}", "non-JSON error response"
        error = payload.get("error") if isinstance(payload, dict) else None
        if not isinstance(error, dict):
            return f"HTTP_{response.status_code}", "unexpected error response"
        code = error.get("code")
        message = error.get("message")
        safe_code = str(code)[:100] if code else f"HTTP_{response.status_code}"
        safe_message = str(message)[:300] if message else "request rejected"
        return safe_code, safe_message

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()
