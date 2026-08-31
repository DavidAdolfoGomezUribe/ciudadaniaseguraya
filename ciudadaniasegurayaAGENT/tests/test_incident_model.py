from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from src.models.incident import IncidentCandidate


def payload() -> dict[str, object]:
    return {
        "cityId": "66a000000000000000000001",
        "incidentType": "hurto",
        "title": "Capturado por hurto en el barrio Restrepo",
        "description": "La fuente reportó un hurto individual en este sector.",
        "occurredAt": "2026-08-20T20:30:00-05:00",
        "latitude": 4.586,
        "longitude": -74.101,
        "address": "Carrera 20 con Calle 15",
        "locationPrecision": "approximate",
        "neighborhood": "Restrepo",
        "sourceUrl": "https://example.com/noticia",
        "evidenceDescription": "La nota identifica fecha, hora y barrio; la ubicación fue geocodificada.",
        "confirmLocation": True,
    }


def test_validates_and_serializes_exact_backend_aliases() -> None:
    candidate = IncidentCandidate.model_validate(payload())
    result = candidate.model_dump(mode="json", by_alias=True)

    assert set(result) == set(payload())
    assert result["occurredAt"] == "2026-08-20T20:30:00-05:00"
    assert result["confirmLocation"] is True


def test_rejects_extra_fields() -> None:
    value = payload() | {"source": "not part of the backend payload"}
    with pytest.raises(ValidationError):
        IncidentCandidate.model_validate(value)


def test_rejects_naive_datetime() -> None:
    value = payload() | {"occurredAt": datetime(2026, 8, 20, 20, 30)}
    with pytest.raises(ValidationError):
        IncidentCandidate.model_validate(value)


def test_rejects_timestamp_beyond_backend_future_tolerance() -> None:
    value = payload() | {"occurredAt": datetime.now(UTC) + timedelta(minutes=6)}
    with pytest.raises(ValidationError):
        IncidentCandidate.model_validate(value)


def test_requires_literal_location_confirmation() -> None:
    value = payload() | {"confirmLocation": False}
    with pytest.raises(ValidationError):
        IncidentCandidate.model_validate(value)


def test_rejects_coordinates_outside_bogota_bounds() -> None:
    value = payload() | {"latitude": 6.25, "longitude": -75.56}
    with pytest.raises(ValidationError):
        IncidentCandidate.model_validate(value)


def test_rejects_coordinates_inside_bbox_but_outside_backend_polygon() -> None:
    value = payload() | {"latitude": 4.80, "longitude": -74.20}
    with pytest.raises(ValidationError):
        IncidentCandidate.model_validate(value)


def test_uses_backend_utf16_length_for_emoji_headline() -> None:
    # Python sees 120 code points, while Zod sees 121 UTF-16 code units.
    value = payload() | {"title": "📹" + ("a" * 119)}
    with pytest.raises(ValidationError):
        IncidentCandidate.model_validate(value)
