from __future__ import annotations

import time
from typing import Any

from pydantic import SecretStr

from src.llm.base import (
    LLMProvider,
    ProviderResponseError,
    ProviderUnavailableError,
    ProviderUsage,
    StructuredModel,
    StructuredResponse,
)


class OpenAIProvider(LLMProvider):
    name = "openai"

    def __init__(
        self,
        *,
        api_key: SecretStr | str | None,
        model: str,
        timeout: float,
        max_retries: int,
        client: Any | None = None,
    ) -> None:
        secret = (
            api_key.get_secret_value()
            if isinstance(api_key, SecretStr)
            else str(api_key or "")
        )
        if not secret:
            raise ValueError("OPENAI_API_KEY must be configured")
        if not model.strip():
            raise ValueError("OPENAI_MODEL must be configured")
        self.model = model.strip()
        if client is None:
            try:
                from openai import AsyncOpenAI
            except ImportError as exc:  # pragma: no cover - dependency guard
                raise ProviderUnavailableError(
                    "The official openai package is not installed"
                ) from exc
            client = AsyncOpenAI(
                api_key=secret,
                timeout=timeout,
                max_retries=max_retries,
            )
        self._client = client
        self._available: bool | None = None

    async def is_available(self) -> bool:
        if self._available is not None:
            return self._available
        try:
            await self._client.models.retrieve(self.model)
        except Exception:
            self._available = False
        else:
            self._available = True
        return self._available

    async def structured_response(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        response_model: type[StructuredModel],
    ) -> StructuredResponse[StructuredModel]:
        started = time.monotonic()
        try:
            response = await self._client.responses.parse(
                model=self.model,
                input=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                text_format=response_model,
                store=False,
            )
        except Exception as exc:
            raise ProviderUnavailableError(
                f"OpenAI Responses API request failed: {exc.__class__.__name__}"
            ) from exc
        output = getattr(response, "output_parsed", None)
        self._available = True
        provider_usage = self._usage(response, started)
        if not isinstance(output, response_model):
            raise ProviderResponseError(
                "OpenAI returned no valid parsed structured output",
                usage=provider_usage,
            )
        return StructuredResponse(output=output, usage=provider_usage)

    @staticmethod
    def _usage(response: Any, started: float) -> ProviderUsage:
        usage = getattr(response, "usage", None)
        input_tokens = getattr(usage, "input_tokens", None)
        output_tokens = getattr(usage, "output_tokens", None)
        return ProviderUsage(
            input_tokens=input_tokens if isinstance(input_tokens, int) else None,
            output_tokens=output_tokens if isinstance(output_tokens, int) else None,
            duration_seconds=time.monotonic() - started,
        )

    async def aclose(self) -> None:
        close = getattr(self._client, "close", None)
        if close is not None:
            result = close()
            if hasattr(result, "__await__"):
                await result
