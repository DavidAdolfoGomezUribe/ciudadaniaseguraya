import json
from datetime import datetime

import pytest

from src.agents.incident_analysis_agent import IncidentAnalysisAgent
from src.agents.models import AgentIncidentDraft
from src.agents.trajectory import TrajectoryRecorder
from src.agents.verifier import AgentDraftVerifier, DraftVerificationError
from src.classifiers.rule_based_classifier import RuleBasedClassifier
from src.config.settings import Settings
from src.extraction.dates import IncidentDateExtractor
from src.extraction.locations import LocationExtractor
from src.geolocation.base import GeocodeResult, Geocoder
from src.llm.base import (
    LLMProvider,
    ProviderUnavailableError,
    ProviderUsage,
    StructuredResponse,
)
from src.models.article import ScrapedArticle
from src.services.agent_pipeline import AgentPipeline


def article() -> ScrapedArticle:
    return ScrapedArticle(
        source="Test News",
        title="Comerciante fue víctima de robo en el barrio Restrepo",
        url="https://example.com/robo-restrepo",
        publication_date=datetime.fromisoformat("2026-08-21T10:00:00-05:00"),
        description="La fuente reportó un robo individual en Bogotá.",
        content=(
            "El robo ocurrió el 20 de agosto de 2026 a las 8:30 p. m. "
            "en el barrio Restrepo, en la localidad de Antonio Nariño, "
            "en la Carrera 20 con Calle 15."
        ),
    )


def draft_payload(*, neighborhood: str = "Restrepo") -> dict[str, object]:
    sentence = article().content
    location_evidence = (
        sentence if neighborhood == "Restrepo" else "en el barrio Inventado"
    )
    return {
        "isIncident": True,
        "incidentType": "robo",
        "occurredAt": "2026-08-20T20:30:00-05:00",
        "locationText": (
            "Carrera 20 con Calle 15"
            if neighborhood == "Restrepo"
            else "barrio Inventado"
        ),
        "neighborhood": neighborhood,
        "locality": "Antonio Nariño" if neighborhood == "Restrepo" else None,
        "description": "A merchant was the victim of a robbery in Restrepo.",
        "evidenceDescription": "The article states the event, time, and location.",
        "incidentTypeEvidence": sentence,
        "occurredAtEvidence": sentence,
        "locationEvidence": location_evidence,
        "neighborhoodEvidence": location_evidence,
        "localityEvidence": sentence if neighborhood == "Restrepo" else None,
        "confidence": 0.9,
        "rejectionReason": None,
    }


def verifier() -> AgentDraftVerifier:
    return AgentDraftVerifier(
        classifier=RuleBasedClassifier(("robo", "hurto")),
        date_extractor=IncidentDateExtractor(),
        location_extractor=LocationExtractor(),
        minimum_confidence=0.65,
        allow_publication_date_fallback=True,
    )


def test_agent_draft_forbids_missing_required_incident_evidence() -> None:
    payload = draft_payload()
    payload["locationEvidence"] = None

    with pytest.raises(ValueError):
        AgentIncidentDraft.model_validate(payload)


def test_agent_draft_forbids_extra_fields_and_populated_rejection() -> None:
    rejected = {
        "isIncident": False,
        "incidentType": "robo",
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
        "rejectionReason": "Not one concrete incident.",
        "unsupported": "value",
    }

    with pytest.raises(ValueError):
        AgentIncidentDraft.model_validate(rejected)


def test_verifier_rejects_hallucinated_location() -> None:
    draft = AgentIncidentDraft.model_validate(
        draft_payload(neighborhood="Inventado")
    )

    with pytest.raises(DraftVerificationError) as error:
        verifier().verify(article(), draft)

    assert error.value.code == "unsupported_evidence"


def test_verifier_accepts_evidence_and_explicit_incident_time() -> None:
    result = verifier().verify(
        article(),
        AgentIncidentDraft.model_validate(draft_payload()),
    )

    assert result.incident_type == "robo"
    assert result.occurred_at.isoformat() == "2026-08-20T20:30:00-05:00"
    assert result.location.neighborhood == "Restrepo"
    assert result.location.address == "Carrera 20 con Calle 15"
    assert "A merchant" not in result.description
    assert "Carrera 20 con Calle 15" in result.description


def test_verifier_uses_exact_evidence_when_location_text_is_composed() -> None:
    payload = draft_payload()
    payload["locationText"] = "Carrera 20 con Calle 15, Antonio Nariño"

    result = verifier().verify(
        article(),
        AgentIncidentDraft.model_validate(payload),
    )

    assert result.location.address == "Carrera 20 con Calle 15"
    assert result.location.locality == "Antonio Nariño"


def test_verifier_recovers_complete_type_evidence_from_exact_source_sentence() -> None:
    payload = draft_payload()
    payload["incidentTypeEvidence"] = "robo"

    result = verifier().verify(
        article(),
        AgentIncidentDraft.model_validate(payload),
    )

    assert result.incident_type == "robo"
    assert result.incident_type_evidence == article().title


def test_verifier_deduplicates_contained_location_fragments() -> None:
    bundle = AgentDraftVerifier._evidence_bundle(
        "en un supermercado ubicado en el barrio El Greco",
        "barrio El Greco",
        "en la localidad de Teusaquillo",
    )

    location = LocationExtractor().extract(bundle)

    assert location is not None
    assert location.neighborhood == "El Greco"


def test_verifier_does_not_repeat_neighborhood_only_address() -> None:
    assert AgentDraftVerifier._neighborhood_note("barrio Laureles", "Laureles") == ""
    assert AgentDraftVerifier._neighborhood_note(
        "Carrera 20 con Calle 15", "Restrepo"
    ) == ", en el barrio Restrepo"


class SequenceProvider(LLMProvider):
    name = "fake"
    model = "fake-model"

    def __init__(self, outputs: list[AgentIncidentDraft]) -> None:
        self.outputs = iter(outputs)
        self.feedback_prompts: list[str] = []

    async def structured_response(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        response_model,
    ):
        self.feedback_prompts.append(user_prompt)
        return StructuredResponse(
            output=next(self.outputs),
            usage=ProviderUsage(input_tokens=10, output_tokens=5),
        )

    async def is_available(self) -> bool:
        return True

    async def aclose(self) -> None:
        pass


class FailingProvider(SequenceProvider):
    async def structured_response(self, **_kwargs):
        raise ProviderUnavailableError("provider unavailable")


class UnavailableProvider(FailingProvider):
    async def is_available(self) -> bool:
        return False


class FakeGeocoder(Geocoder):
    async def geocode(self, location):
        return GeocodeResult(
            latitude=4.586,
            longitude=-74.101,
            display_name="Restrepo, Antonio Nariño, Bogotá, Colombia",
            matched_query=location.address,
        )


def pipeline(tmp_path, provider: LLMProvider) -> AgentPipeline:
    settings = Settings(
        agent_max_retries=1,
        trajectories_path=tmp_path,
    )
    return AgentPipeline(
        settings=settings,
        agent=IncidentAnalysisAgent(
            provider=provider,
            maximum_content_chars=30_000,
        ),
        verifier=verifier(),
        geocoder=FakeGeocoder(),
        recorder=TrajectoryRecorder(directory=tmp_path, run_id="test-run"),
    )


@pytest.mark.asyncio
async def test_agent_pipeline_retries_once_after_verifier_feedback(tmp_path) -> None:
    provider = SequenceProvider(
        [
            AgentIncidentDraft.model_validate(
                draft_payload(neighborhood="Inventado")
            ),
            AgentIncidentDraft.model_validate(draft_payload()),
        ]
    )

    result = await pipeline(tmp_path, provider).run([article()])

    assert len(result.incidents) == 1
    assert result.stats.agent_retries == 1
    assert result.stats.validation_failures == 1
    assert "Verifier feedback" in provider.feedback_prompts[1]
    records = [json.loads(line) for line in result.trajectory_path.read_text().splitlines()]
    assert records[0]["finalDecision"] == "accepted"
    assert records[0]["retryOutput"] is not None
    assert "reasoning" not in records[0]


@pytest.mark.asyncio
async def test_agent_pipeline_fails_run_on_systemic_provider_failure(tmp_path) -> None:
    with pytest.raises(ProviderUnavailableError):
        await pipeline(tmp_path, FailingProvider([])).run([article()])


@pytest.mark.asyncio
async def test_agent_pipeline_stops_before_analysis_when_model_is_unavailable(
    tmp_path,
) -> None:
    provider = UnavailableProvider([])

    with pytest.raises(ProviderUnavailableError):
        await pipeline(tmp_path, provider).run([article()])

    assert provider.feedback_prompts == []


@pytest.mark.asyncio
async def test_agent_pipeline_stops_after_target_incident_count(tmp_path) -> None:
    provider = SequenceProvider(
        [AgentIncidentDraft.model_validate(draft_payload()) for _ in range(3)]
    )

    result = await pipeline(tmp_path, provider).run(
        [article(), article(), article()],
        target_incidents=2,
    )

    assert len(result.incidents) == 2
    assert result.stats.total_articles == 2
    assert len(provider.feedback_prompts) == 2
