from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    field_validator,
    model_validator,
)

from src.models.incident import IncidentType


class AgentIncidentDraft(BaseModel):
    """Evidence-bearing proposal produced by the single Iteration 2 agent."""

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        str_strip_whitespace=True,
    )

    is_incident: bool = Field(alias="isIncident")
    incident_type: IncidentType | None = Field(alias="incidentType")
    occurred_at: datetime | None = Field(alias="occurredAt")
    location_text: str | None = Field(alias="locationText", max_length=200)
    neighborhood: str | None = Field(max_length=100)
    locality: str | None = Field(max_length=100)
    description: str | None = Field(max_length=2_000)
    evidence_description: str | None = Field(
        alias="evidenceDescription",
        max_length=500,
    )
    incident_type_evidence: str | None = Field(
        alias="incidentTypeEvidence",
        max_length=500,
    )
    occurred_at_evidence: str | None = Field(
        alias="occurredAtEvidence",
        max_length=500,
    )
    location_evidence: str | None = Field(
        alias="locationEvidence",
        max_length=500,
    )
    neighborhood_evidence: str | None = Field(
        alias="neighborhoodEvidence",
        max_length=500,
    )
    locality_evidence: str | None = Field(
        alias="localityEvidence",
        max_length=500,
    )
    confidence: float = Field(ge=0, le=1)
    rejection_reason: str | None = Field(alias="rejectionReason", max_length=500)

    @field_validator("occurred_at")
    @classmethod
    def occurred_at_has_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.utcoffset() is None:
            raise ValueError("occurredAt must include a timezone offset")
        return value

    @model_validator(mode="after")
    def internally_consistent(self) -> "AgentIncidentDraft":
        if not self.is_incident:
            if not self.rejection_reason:
                raise ValueError("rejectionReason is required when isIncident is false")
            incident_values = {
                "incidentType": self.incident_type,
                "occurredAt": self.occurred_at,
                "locationText": self.location_text,
                "neighborhood": self.neighborhood,
                "locality": self.locality,
                "description": self.description,
                "evidenceDescription": self.evidence_description,
                "incidentTypeEvidence": self.incident_type_evidence,
                "occurredAtEvidence": self.occurred_at_evidence,
                "locationEvidence": self.location_evidence,
                "neighborhoodEvidence": self.neighborhood_evidence,
                "localityEvidence": self.locality_evidence,
            }
            populated = [name for name, value in incident_values.items() if value is not None]
            if populated:
                raise ValueError(
                    "Rejected drafts must leave incident fields null: "
                    + ", ".join(populated)
                )
            return self

        if self.rejection_reason is not None:
            raise ValueError("rejectionReason must be null when isIncident is true")

        required = {
            "incidentType": self.incident_type,
            "locationText": self.location_text,
            "description": self.description,
            "evidenceDescription": self.evidence_description,
            "incidentTypeEvidence": self.incident_type_evidence,
            "locationEvidence": self.location_evidence,
        }
        missing = [name for name, value in required.items() if value is None]
        if missing:
            raise ValueError(
                "Incident drafts require these supported fields: " + ", ".join(missing)
            )
        if self.occurred_at is not None and self.occurred_at_evidence is None:
            raise ValueError("occurredAtEvidence is required when occurredAt is present")
        if self.neighborhood is not None and self.neighborhood_evidence is None:
            raise ValueError(
                "neighborhoodEvidence is required when neighborhood is present"
            )
        if self.neighborhood is None and self.neighborhood_evidence is not None:
            raise ValueError(
                "neighborhood must be present when neighborhoodEvidence is present"
            )
        if self.locality is not None and self.locality_evidence is None:
            raise ValueError("localityEvidence is required when locality is present")
        return self


class TrajectoryRecord(BaseModel):
    """Observable execution record; never contains hidden chain-of-thought."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    run_id: str = Field(alias="runId")
    timestamp: datetime
    provider: str
    model: str
    article_source: str = Field(alias="articleSource")
    article_url: HttpUrl = Field(alias="articleUrl")
    prompt_version: str = Field(alias="promptVersion")
    agent_structured_output: dict[str, object] | None = Field(
        alias="agentStructuredOutput"
    )
    verifier_result: dict[str, object] | None = Field(alias="verifierResult")
    geocoder_result: dict[str, object] | None = Field(alias="geocoderResult")
    retry_feedback: str | None = Field(alias="retryFeedback")
    retry_output: dict[str, object] | None = Field(alias="retryOutput")
    final_decision: str = Field(alias="finalDecision")
    execution_time_seconds: float = Field(alias="executionTimeSeconds", ge=0)
    input_tokens: int | None = Field(alias="inputTokens", ge=0)
    output_tokens: int | None = Field(alias="outputTokens", ge=0)
