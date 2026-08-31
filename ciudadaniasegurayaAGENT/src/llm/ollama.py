from __future__ import annotations

import asyncio
import time
from typing import Any

import httpx
from pydantic import ValidationError

from src.llm.base import (
    LLMProvider,
    ProviderResponseError,
    ProviderUnavailableError,
    ProviderUsage,
    StructuredModel,
    StructuredResponse,
)


def _ollama_compatible_schema(schema: dict[str, Any]) -> dict[str, Any]:
    """Remove grammar-heavy string bounds while preserving Pydantic validation.

    Ollama converts JSON Schema to a runtime grammar. Large ``maxLength``
    repetitions can exceed that grammar parser's safety limit even though the
    schema itself is valid. The response is still validated against the full
    Pydantic model immediately after generation.
    """

    def visit(value: Any) -> Any:
        if isinstance(value, dict):
            return {
                key: visit(item)
                for key, item in value.items()
                if key not in {"minLength", "maxLength"}
            }
        if isinstance(value, list):
            return [visit(item) for item in value]
        return value

    return visit(schema)


class OllamaProvider(LLMProvider):
    name = "ollama"

    def __init__(
        self,
        *,
        base_url: str,
        model: str,
        timeout: float,
        max_retries: int,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        if not model.strip():
            raise ValueError("OLLAMA_MODEL must be configured")
        self.base_url = base_url.rstrip("/")
        self.model = model.strip()
        self.max_retries = max_retries
        self._client = httpx.AsyncClient(
            base_url=self.base_url,
            timeout=httpx.Timeout(timeout),
            transport=transport,
        )

    async def is_available(self) -> bool:
        try:
            response = await self._client.get("/api/tags")
            if response.status_code != 200:
                return False
            payload = response.json()
            models = payload.get("models", [])
            return any(
                isinstance(item, dict)
                and self.model in {item.get("name"), item.get("model")}
                for item in models
            )
        except (httpx.HTTPError, TypeError, ValueError):
            return False

    async def structured_response(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        response_model: type[StructuredModel],
    ) -> StructuredResponse[StructuredModel]:
        started = time.monotonic()
        response: httpx.Response | None = None
        for attempt in range(self.max_retries + 1):
            try:
                response = await self._client.post(
                    "/api/chat",
                    json={
                        "model": self.model,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                        "stream": False,
                        "think": False,
                        "format": _ollama_compatible_schema(
                            response_model.model_json_schema(by_alias=True)
                        ),
                        "options": {"temperature": 0},
                    },
                )
            except httpx.HTTPError as exc:
                if attempt < self.max_retries:
                    await asyncio.sleep(0.5 * (2**attempt))
                    continue
                raise ProviderUnavailableError(f"Ollama request failed: {exc}") from exc
            if response.status_code == 200:
                break
            if (response.status_code == 429 or response.status_code >= 500) and attempt < self.max_retries:
                await asyncio.sleep(0.5 * (2**attempt))
                continue
            raise ProviderUnavailableError(
                f"Ollama returned HTTP {response.status_code}"
            )

        if response is None:  # pragma: no cover - defensive invariant
            raise ProviderUnavailableError("Ollama returned no response")
        payload: Any = {}
        try:
            payload = response.json()
            content = payload["message"]["content"]
            if not isinstance(content, str):
                raise TypeError("message.content is not text")
            output = response_model.model_validate_json(content)
        except (ValueError, TypeError, KeyError, ValidationError) as exc:
            raise ProviderResponseError(
                "Ollama returned invalid structured output",
                usage=self._usage(payload, started),
            ) from exc

        return StructuredResponse(
            output=output,
            usage=self._usage(payload, started),
        )

    @staticmethod
    def _usage(payload: Any, started: float) -> ProviderUsage:
        input_tokens = payload.get("prompt_eval_count") if isinstance(payload, dict) else None
        output_tokens = payload.get("eval_count") if isinstance(payload, dict) else None
        return ProviderUsage(
            input_tokens=input_tokens if isinstance(input_tokens, int) else None,
            output_tokens=output_tokens if isinstance(output_tokens, int) else None,
            duration_seconds=time.monotonic() - started,
        )

    async def aclose(self) -> None:
        await self._client.aclose()
