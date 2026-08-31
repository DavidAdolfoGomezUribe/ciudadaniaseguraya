from datetime import UTC, datetime, timedelta
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    ValidationInfo,
    field_validator,
    model_validator,
)

from src.config.constants import BACKEND_INCIDENT_TYPES, BOGOTA_BOUNDS
from src.geolocation.boundary import point_inside_bogota

IncidentType = Literal[
    "atraco",
    "homicidio",
    "robo",
    "hurto",
    "agresion",
    "secuestro",
    "extorsion",
    "violencia_sexual",
    "violencia_intrafamiliar",
    "vandalismo",
    "actividad_sospechosa",
    "otro",
]


class IncidentCandidate(BaseModel):
    """Strict Iteration 1 payload compatible with the existing backend."""

    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        str_strip_whitespace=True,
    )

    city_id: str = Field(alias="cityId", pattern=r"^[0-9a-fA-F]{24}$")
    incident_type: IncidentType = Field(alias="incidentType")
    title: str = Field(min_length=5, max_length=120)
    description: str = Field(min_length=10, max_length=2_000)
    occurred_at: datetime = Field(alias="occurredAt")
    latitude: float = Field(
        ge=BOGOTA_BOUNDS["south"],
        le=BOGOTA_BOUNDS["north"],
        allow_inf_nan=False,
    )
    longitude: float = Field(
        ge=BOGOTA_BOUNDS["west"],
        le=BOGOTA_BOUNDS["east"],
        allow_inf_nan=False,
    )
    address: str = Field(min_length=2, max_length=200)
    location_precision: Literal["approximate"] = Field(alias="locationPrecision")
    neighborhood: str | None = Field(default=None, min_length=2, max_length=100)
    source_url: HttpUrl = Field(alias="sourceUrl")
    evidence_description: str = Field(
        alias="evidenceDescription", min_length=10, max_length=500
    )
    confirm_location: Literal[True] = Field(alias="confirmLocation")

    @field_validator("incident_type")
    @classmethod
    def uses_backend_enum(cls, value: str) -> str:
        if value not in BACKEND_INCIDENT_TYPES:
            raise ValueError("incidentType is not supported by the backend")
        return value

    @field_validator("occurred_at")
    @classmethod
    def occurred_at_has_timezone(cls, value: datetime) -> datetime:
        if value.utcoffset() is None:
            raise ValueError("occurredAt must include a timezone offset")
        if value.astimezone(UTC) > datetime.now(UTC) + timedelta(minutes=5):
            raise ValueError("occurredAt cannot be more than five minutes in the future")
        return value

    @field_validator("source_url")
    @classmethod
    def source_url_matches_backend_limit(cls, value: HttpUrl) -> HttpUrl:
        if len(str(value)) > 2_048:
            raise ValueError("sourceUrl must contain at most 2048 characters")
        return value

    @field_validator(
        "title",
        "description",
        "address",
        "evidence_description",
    )
    @classmethod
    def matches_backend_utf16_limits(
        cls,
        value: str,
        info: ValidationInfo,
    ) -> str:
        # JavaScript/Zod counts UTF-16 code units, whereas Python counts
        # Unicode code points. This matters for emoji used in real headlines.
        limits = {
            "title": 120,
            "description": 2_000,
            "address": 200,
            "neighborhood": 100,
            "evidence_description": 500,
        }
        if len(value.encode("utf-16-le")) // 2 > limits[info.field_name]:
            raise ValueError(
                f"{info.field_name} exceeds the backend UTF-16 length limit"
            )
        return value

    @field_validator("neighborhood")
    @classmethod
    def optional_neighborhood_matches_backend_limit(
        cls,
        value: str | None,
    ) -> str | None:
        if value is not None and len(value.encode("utf-16-le")) // 2 > 100:
            raise ValueError("neighborhood exceeds the backend UTF-16 length limit")
        return value

    @model_validator(mode="after")
    def coordinates_belong_to_backend_city_boundary(self) -> "IncidentCandidate":
        if not point_inside_bogota(self.latitude, self.longitude):
            raise ValueError("coordinates are outside the configured Bogotá boundary")
        return self
