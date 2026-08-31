from types import SimpleNamespace

import httpx
import pytest

import src.api.routes as routes
from src.config.settings import Settings
from src.main import app
from src.models.incident import IncidentCandidate
from src.services.news_pipeline import PipelineStats


def candidate() -> IncidentCandidate:
    return IncidentCandidate.model_validate(
        {
            "cityId": "66a000000000000000000001",
            "incidentType": "hurto",
            "title": "Capturado por hurto en el barrio Restrepo",
            "description": "La fuente reportó un hurto individual en este sector.",
            "occurredAt": "2026-08-20T20:30:00-05:00",
            "latitude": 4.586,
            "longitude": -74.101,
            "address": "barrio Restrepo",
            "locationPrecision": "approximate",
            "neighborhood": "Restrepo",
            "sourceUrl": "https://example.com/noticia",
            "evidenceDescription": (
                "La nota identifica el hecho y el barrio; la ubicación fue "
                "geocodificada y validada dentro de Bogotá."
            ),
            "confirmLocation": True,
        }
    )


class FakePipeline:
    def __init__(self, incidents: list[IncidentCandidate]) -> None:
        self.incidents = incidents

    async def __aenter__(self):
        return self

    async def __aexit__(self, *_args) -> None:
        pass

    async def run(self, *, limit: int):
        stats = PipelineStats(valid_incidents=len(self.incidents))
        return SimpleNamespace(incidents=self.incidents, stats=stats)


async def app_get(path: str) -> httpx.Response:
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(
        transport=transport,
        base_url="http://testserver",
    ) as client:
        return await client.get(path)


@pytest.mark.asyncio
async def test_health() -> None:
    response = await app_get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_scrape_returns_only_backend_payload_objects(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(routes, "build_pipeline", lambda settings: FakePipeline([candidate()]))

    response = await app_get("/scrape?limit=1")

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.headers["x-geocoding-attribution"] == (
        "OpenStreetMap contributors; Nominatim"
    )
    assert set(response.json()[0]) == {
        "cityId",
        "incidentType",
        "title",
        "description",
        "occurredAt",
        "latitude",
        "longitude",
        "address",
        "locationPrecision",
        "neighborhood",
        "sourceUrl",
        "evidenceDescription",
        "confirmLocation",
    }


@pytest.mark.asyncio
async def test_scrape_reports_when_it_cannot_complete_the_requested_amount(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(routes, "build_pipeline", lambda settings: FakePipeline([candidate()]))

    response = await app_get("/scrape?limit=2")

    assert response.status_code == 503
    assert "Only 1 of 2" in response.json()["detail"]["message"]


@pytest.mark.asyncio
async def test_scrape_rejects_more_than_five() -> None:
    response = await app_get("/scrape?limit=6")

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_providers_reports_configuration_without_secrets(monkeypatch) -> None:
    class FakeOllamaClient:
        def __init__(self, **_kwargs) -> None:
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args) -> None:
            pass

        async def get(self, _path: str) -> httpx.Response:
            return httpx.Response(200)

    monkeypatch.setattr(
        routes,
        "httpx",
        SimpleNamespace(AsyncClient=FakeOllamaClient, HTTPError=httpx.HTTPError),
    )
    monkeypatch.setattr(
        routes,
        "get_settings",
        lambda: Settings(
            ollama_model="configured-local-model",
            openai_api_key="top-secret",
            openai_model="configured-cloud-model",
        ),
    )

    response = await app_get("/providers")

    assert response.status_code == 200
    assert response.json()["ollama"]["status"] == "available"
    assert response.json()["openai"]["status"] == "configured"
    assert "top-secret" not in response.text
