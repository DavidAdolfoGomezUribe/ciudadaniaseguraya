from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Generic, TypeVar

from pydantic import BaseModel

StructuredModel = TypeVar("StructuredModel", bound=BaseModel)


@dataclass(frozen=True, slots=True)
class ProviderUsage:
    input_tokens: int | None = None
    output_tokens: int | None = None
    duration_seconds: float = 0.0


class ProviderError(RuntimeError):
    def __init__(
        self,
        message: str,
        *,
        usage: ProviderUsage | None = None,
    ) -> None:
        super().__init__(message)
        self.usage = usage


class ProviderUnavailableError(ProviderError):
    pass


class ProviderResponseError(ProviderError):
    pass


@dataclass(frozen=True, slots=True)
class StructuredResponse(Generic[StructuredModel]):
    output: StructuredModel
    usage: ProviderUsage


class LLMProvider(ABC):
    name: str
    model: str

    @abstractmethod
    async def structured_response(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        response_model: type[StructuredModel],
    ) -> StructuredResponse[StructuredModel]:
        pass

    @abstractmethod
    async def is_available(self) -> bool:
        pass

    @abstractmethod
    async def aclose(self) -> None:
        pass
