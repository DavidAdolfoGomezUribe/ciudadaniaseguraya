import json
from datetime import datetime

import httpx
import pytest
from pydantic import SecretStr

from src.integrations.backend import BackendIncidentClient, BackendIngestError
from src.models.incident import IncidentCandidate
from src.services.ingestion_service import (
    IncidentIngestionService,
    load_incidents_jsonl,
    save_incidents_jsonl,
)


def candidate(*, source_url: str = "https://example.com/incident") -> IncidentCandidate:
    return IncidentCandidate(
        cityId="6a6761d90b11cc2370bf3321",
        incidentType="robo",
        title="Robo reportado en el barrio Restrepo",
        description="La fuente reporta un robo en el barrio Restrepo.",
        occurredAt=datetime.fromisoformat("2026-08-20T20:30:00-05:00"),
        latitude=4.586,
        longitude=-74.101,
        address="Carrera 20 con Calle 15",
        locationPrecision="approximate",
        neighborhood="Restrepo",
        sourceUrl=source_url,
        evidenceDescription="La noticia identifica el robo y su ubicación.",
        confirmLocation=True,
    )


@pytest.mark.asyncio
async def test_backend_client_submits_exact_candidate_contract() -> None:
    observed: dict[str, object] = {}

    async def handler(request: httpx.Request) -> httpx.Response:
        observed["key"] = request.headers["X-AI-Ingest-Key"]
        observed["payload"] = json.loads(request.content)
        return httpx.Response(
            201,
            json={
                "success": True,
                "data": {
                    "id": "6a7000000000000000000001",
                    "status": "pending",
                    "submissionSource": "ai_scraper",
                },
                "meta": {"requestId": "req-test"},
            },
        )

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as http_client:
        client = BackendIncidentClient(
            url="https://backend.example/api/v1/integrations/ai/incidents",
            api_key=SecretStr("secret-value"),
            timeout=20,
            client=http_client,
        )
        receipt = await client.submit(candidate())

    assert observed["key"] == "secret-value"
    assert observed["payload"]["confirmLocation"] is True
    assert observed["payload"]["cityId"] == "6a6761d90b11cc2370bf3321"
    assert receipt.incident_id == "6a7000000000000000000001"
    assert receipt.status == "pending"
    assert receipt.submission_source == "ai_scraper"
    assert receipt.request_id == "req-test"


@pytest.mark.asyncio
async def test_backend_client_reports_safe_rejection_without_retry() -> None:
    requests = 0

    async def handler(_request: httpx.Request) -> httpx.Response:
        nonlocal requests
        requests += 1
        return httpx.Response(
            401,
            json={
                "success": False,
                "error": {
                    "code": "AI_INGEST_UNAUTHENTICATED",
                    "message": "La clave no es valida",
                },
            },
        )

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as http_client:
        client = BackendIncidentClient(
            url="https://backend.example/api/v1/integrations/ai/incidents",
            api_key="do-not-print-this-secret",
            timeout=20,
            client=http_client,
        )
        with pytest.raises(BackendIngestError) as error:
            await client.submit(candidate())

    assert requests == 1
    assert error.value.status_code == 401
    assert "AI_INGEST_UNAUTHENTICATED" in str(error.value)
    assert "do-not-print-this-secret" not in str(error.value)


@pytest.mark.asyncio
async def test_ingestion_service_submits_only_requested_candidates() -> None:
    submitted: list[str] = []

    class FakeClient:
        async def submit(self, item: IncidentCandidate):
            submitted.append(str(item.source_url))
            from src.integrations.backend import BackendIngestReceipt

            return BackendIngestReceipt(
                incident_id=f"6a700000000000000000000{len(submitted)}",
                status="pending",
                submission_source="ai_scraper",
                request_id=f"req-{len(submitted)}",
            )

    candidates = [
        candidate(source_url=f"https://example.com/incident-{index}")
        for index in range(3)
    ]
    results = await IncidentIngestionService(FakeClient()).ingest(
        candidates,
        limit=2,
    )

    assert len(results) == 2
    assert submitted == [
        "https://example.com/incident-0",
        "https://example.com/incident-1",
    ]


def test_candidate_jsonl_round_trip_and_duplicate_rejection(tmp_path) -> None:
    path = tmp_path / "candidates.jsonl"
    save_incidents_jsonl(
        [candidate(source_url="https://example.com/one")],
        path,
    )

    loaded = load_incidents_jsonl(path)

    assert loaded == [candidate(source_url="https://example.com/one")]
    duplicated = path.read_text(encoding="utf-8") * 2
    path.write_text(duplicated, encoding="utf-8")
    with pytest.raises(ValueError, match="Duplicate sourceUrl"):
        load_incidents_jsonl(path)
