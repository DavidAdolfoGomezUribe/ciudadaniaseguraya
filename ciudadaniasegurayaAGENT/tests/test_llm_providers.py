import json
from types import SimpleNamespace

import httpx
import pytest

from src.agents.models import AgentIncidentDraft
from src.llm.base import LLMProvider, ProviderResponseError
from src.llm.ollama import OllamaProvider
from src.llm.openai import OpenAIProvider


def rejected_payload() -> dict[str, object]:
    return {
        "isIncident": False,
        "incidentType": None,
        "occurredAt": None,
        "locationText": None,
        "neighborhood": None,
        "locality": None,
        "description": None,
        "evidenceDescription": None,
        "incidentTypeEvidence": None,
        "occurredAtEvidence": None,
        "locationEvidence": None,
        "neighborhoodEvidence": None,
        "localityEvidence": None,
        "confidence": 0.2,
        "rejectionReason": "The article is a statistical report.",
    }


@pytest.mark.asyncio
async def test_ollama_provider_uses_json_schema_and_reports_usage() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/tags":
            return httpx.Response(
                200,
                json={"models": [{"name": "test-model", "model": "test-model"}]},
            )
        body = json.loads(request.content)
        assert body["stream"] is False
        assert body["think"] is False
        assert body["format"]["additionalProperties"] is False
        assert "maxLength" not in json.dumps(body["format"])
        return httpx.Response(
            200,
            json={
                "message": {"role": "assistant", "content": json.dumps(rejected_payload())},
                "prompt_eval_count": 123,
                "eval_count": 45,
            },
        )

    provider = OllamaProvider(
        base_url="http://localhost:11434",
        model="test-model",
        timeout=5,
        max_retries=0,
        transport=httpx.MockTransport(handler),
    )

    assert isinstance(provider, LLMProvider)
    assert await provider.is_available()
    response = await provider.structured_response(
        system_prompt="system",
        user_prompt="article",
        response_model=AgentIncidentDraft,
    )
    await provider.aclose()

    assert response.output.is_incident is False
    assert response.usage.input_tokens == 123
    assert response.usage.output_tokens == 45


@pytest.mark.asyncio
async def test_ollama_provider_rejects_invalid_json() -> None:
    provider = OllamaProvider(
        base_url="http://localhost:11434",
        model="test-model",
        timeout=5,
        max_retries=0,
        transport=httpx.MockTransport(
            lambda _request: httpx.Response(
                200,
                json={
                    "message": {"content": "not-json"},
                    "prompt_eval_count": 12,
                    "eval_count": 3,
                },
            )
        ),
    )

    with pytest.raises(ProviderResponseError) as error:
        await provider.structured_response(
            system_prompt="system",
            user_prompt="article",
            response_model=AgentIncidentDraft,
        )
    assert error.value.usage is not None
    assert error.value.usage.input_tokens == 12
    assert error.value.usage.output_tokens == 3
    await provider.aclose()


@pytest.mark.asyncio
async def test_ollama_availability_requires_the_configured_model() -> None:
    provider = OllamaProvider(
        base_url="http://localhost:11434",
        model="missing-model",
        timeout=5,
        max_retries=0,
        transport=httpx.MockTransport(
            lambda _request: httpx.Response(
                200,
                json={"models": [{"name": "another-model"}]},
            )
        ),
    )

    assert await provider.is_available() is False
    await provider.aclose()


class FakeResponses:
    def __init__(self, output: AgentIncidentDraft) -> None:
        self.output = output
        self.kwargs = None

    async def parse(self, **kwargs):
        self.kwargs = kwargs
        return SimpleNamespace(
            output_parsed=self.output,
            usage=SimpleNamespace(input_tokens=80, output_tokens=20),
        )


class FakeOpenAIClient:
    def __init__(self, output: AgentIncidentDraft) -> None:
        self.responses = FakeResponses(output)
        self.models = SimpleNamespace(retrieve=self.retrieve_model)
        self.closed = False

    async def retrieve_model(self, model: str):
        return SimpleNamespace(id=model)

    async def close(self) -> None:
        self.closed = True


@pytest.mark.asyncio
async def test_openai_provider_uses_responses_parse_without_exposing_key() -> None:
    output = AgentIncidentDraft.model_validate(rejected_payload())
    client = FakeOpenAIClient(output)
    provider = OpenAIProvider(
        api_key="secret-test-key",
        model="configured-model",
        timeout=5,
        max_retries=0,
        client=client,
    )

    assert await provider.is_available() is True

    response = await provider.structured_response(
        system_prompt="system",
        user_prompt="article",
        response_model=AgentIncidentDraft,
    )
    await provider.aclose()

    assert response.output == output
    assert client.responses.kwargs["text_format"] is AgentIncidentDraft
    assert client.responses.kwargs["store"] is False
    assert response.usage.input_tokens == 80
    assert response.usage.output_tokens == 20
    assert client.closed is True


class FailingResponses:
    async def parse(self, **_kwargs):
        raise RuntimeError("secret-test-key must never be repeated")


class FailingModels:
    async def retrieve(self, _model: str):
        raise RuntimeError("secret-test-key must never be repeated")


@pytest.mark.asyncio
async def test_openai_provider_error_does_not_expose_the_api_key() -> None:
    client = SimpleNamespace(responses=FailingResponses())
    provider = OpenAIProvider(
        api_key="secret-test-key",
        model="configured-model",
        timeout=5,
        max_retries=0,
        client=client,
    )

    with pytest.raises(Exception) as error:
        await provider.structured_response(
            system_prompt="system",
            user_prompt="article",
            response_model=AgentIncidentDraft,
        )

    assert "secret-test-key" not in str(error.value)


@pytest.mark.asyncio
async def test_openai_availability_checks_the_configured_model() -> None:
    client = SimpleNamespace(models=FailingModels())
    provider = OpenAIProvider(
        api_key="secret-test-key",
        model="configured-model",
        timeout=5,
        max_retries=0,
        client=client,
    )

    assert await provider.is_available() is False
