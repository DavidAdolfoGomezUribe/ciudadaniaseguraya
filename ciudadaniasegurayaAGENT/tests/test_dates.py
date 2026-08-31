from datetime import datetime, timedelta, timezone

import pytest

from src.extraction.dates import DateExtraction, IncidentDateExtractor


@pytest.fixture
def extractor() -> IncidentDateExtractor:
    return IncidentDateExtractor()


def test_extracts_absolute_date_and_pm_time(extractor: IncidentDateExtractor) -> None:
    result = extractor.extract(
        "Los hechos ocurrieron el miércoles 26 de agosto de 2026 a las 8:30 p. m.",
        datetime(2026, 8, 28, 9, 0),
    )

    assert isinstance(result, DateExtraction)
    assert result.value.isoformat() == "2026-08-26T20:30:00-05:00"
    assert "hechos ocurrieron" in result.evidence


def test_absolute_date_does_not_require_publication_anchor(
    extractor: IncidentDateExtractor,
) -> None:
    result = extractor.extract(
        "El robo se registró el 03 de enero de 2025 a las 06:05.",
        None,
    )

    assert result is not None
    assert result.value.isoformat() == "2025-01-03T06:05:00-05:00"


@pytest.mark.parametrize(
    ("word", "days_ago"),
    [("hoy", 0), ("ayer", 1), ("anteayer", 2)],
)
def test_relative_days_use_publication_as_anchor(
    extractor: IncidentDateExtractor,
    word: str,
    days_ago: int,
) -> None:
    publication = datetime(2026, 8, 29, 23, 59, tzinfo=timezone.utc)

    result = extractor.extract(
        f"{word.capitalize()} a las 18:45 se registró un hurto.",
        publication,
    )

    assert result is not None
    bogota_publication_day = datetime(2026, 8, 29, 18, 15).date()
    assert result.value.date() == bogota_publication_day - timedelta(days=days_ago)
    assert (result.value.hour, result.value.minute) == (18, 45)
    assert result.value.utcoffset() == timedelta(hours=-5)


def test_este_weekday_means_latest_non_future_weekday(
    extractor: IncidentDateExtractor,
) -> None:
    publication = datetime(2026, 8, 29, 12, 0)  # Saturday in Bogotá.

    result = extractor.extract(
        "Este martes, a las 7:10 a. m., fue atacado un comerciante.",
        publication,
    )

    assert result is not None
    assert result.value.isoformat() == "2026-08-25T07:10:00-05:00"


def test_pasado_weekday_is_strictly_previous_when_anchor_is_same_day(
    extractor: IncidentDateExtractor,
) -> None:
    publication = datetime(2026, 8, 26, 12, 0)  # Wednesday in Bogotá.

    result = extractor.extract(
        "El pasado miércoles a las 21:00 ocurrió el asalto.",
        publication,
    )

    assert result is not None
    assert result.value.isoformat() == "2026-08-19T21:00:00-05:00"


def test_explicit_day_and_month_can_use_anchor_only_for_omitted_year(
    extractor: IncidentDateExtractor,
) -> None:
    result = extractor.extract(
        "El hecho ocurrió el 31 de diciembre a las 23:10.",
        datetime(2026, 1, 2, 10, 0),
    )

    assert result is not None
    assert result.value.isoformat() == "2025-12-31T23:10:00-05:00"


def test_rejects_relative_expression_without_anchor(
    extractor: IncidentDateExtractor,
) -> None:
    assert extractor.extract("Ayer a las 18:45 ocurrió un hurto.", None) is None


def test_rejects_incident_date_without_explicit_time(
    extractor: IncidentDateExtractor,
) -> None:
    assert (
        extractor.extract(
            "Los hechos ocurrieron el 26 de agosto de 2026 durante la noche.",
            datetime(2026, 8, 28, 9, 0),
        )
        is None
    )


def test_rejects_ambiguous_hour_without_period_or_minutes(
    extractor: IncidentDateExtractor,
) -> None:
    assert (
        extractor.extract(
            "El hecho ocurrió el 26 de agosto de 2026 a las 8.",
            datetime(2026, 8, 28, 9, 0),
        )
        is None
    )


def test_rejects_bare_clock_even_with_minutes(
    extractor: IncidentDateExtractor,
) -> None:
    assert (
        extractor.extract(
            "El hecho ocurrió el 26 de agosto de 2026, 18:45.",
            datetime(2026, 8, 28, 9, 0),
        )
        is None
    )


@pytest.mark.parametrize(
    ("phrase", "expected_time"),
    [
        ("a las 18:45", "18:45:00"),
        ("hacia las 18:45", "18:45:00"),
        ("sobre las 18:45", "18:45:00"),
        ("8:45 a. m.", "08:45:00"),
        ("8:45 p. m.", "20:45:00"),
        ("18:45 horas", "18:45:00"),
    ],
)
def test_accepts_only_explicitly_marked_clocks(
    extractor: IncidentDateExtractor,
    phrase: str,
    expected_time: str,
) -> None:
    result = extractor.extract(
        f"El hecho ocurrió el 26 de agosto de 2026 {phrase}.",
        datetime(2026, 8, 27, 9, 0),
    )

    assert result is not None
    assert result.value.time().isoformat() == expected_time


def test_unmarked_clock_with_natural_period_is_rejected(
    extractor: IncidentDateExtractor,
) -> None:
    assert (
        extractor.extract(
            "El hecho ocurrió el 26 de agosto de 2026, 8:45 de la noche.",
            datetime(2026, 8, 27, 9, 0),
        )
        is None
    )


@pytest.mark.parametrize(
    "time_expression",
    [
        "durante 01:30 horas",
        "con una duración de 01:30 horas",
        "por 01:30 horas",
        "01:30 horas de duración",
    ],
)
def test_rejects_durations_as_incident_times(
    extractor: IncidentDateExtractor,
    time_expression: str,
) -> None:
    assert (
        extractor.extract(
            f"El hecho ocurrió el 26 de agosto de 2026 {time_expression}.",
            datetime(2026, 8, 27, 9, 0),
        )
        is None
    )


@pytest.mark.parametrize(
    "time_expression",
    [
        "entre las 8:30 p. m. y las 9:00 p. m.",
        "desde las 18:30 horas hasta las 20:00 horas",
        "de 8:30 p. m. a 9:00 p. m.",
    ],
)
def test_rejects_time_ranges_and_alternatives(
    extractor: IncidentDateExtractor,
    time_expression: str,
) -> None:
    assert (
        extractor.extract(
            f"El hecho ocurrió el 26 de agosto de 2026 {time_expression}.",
            datetime(2026, 8, 27, 9, 0),
        )
        is None
    )


@pytest.mark.parametrize(
    "time_expression",
    [
        "antes de las 18:30 horas",
        "después de las 18:30 horas",
        "hasta las 18:30 horas",
        "a más tardar a las 18:30",
    ],
)
def test_rejects_temporal_bounds_as_exact_times(
    extractor: IncidentDateExtractor,
    time_expression: str,
) -> None:
    assert (
        extractor.extract(
            f"El hecho ocurrió el 26 de agosto de 2026 {time_expression}.",
            datetime(2026, 8, 27, 9, 0),
        )
        is None
    )


def test_never_uses_publication_date_as_missing_incident_date(
    extractor: IncidentDateExtractor,
) -> None:
    assert (
        extractor.extract(
            "El hecho ocurrió a las 18:30 en el centro de Bogotá.",
            datetime(2026, 8, 28, 18, 30),
        )
        is None
    )


def test_rejects_editorial_timestamp(extractor: IncidentDateExtractor) -> None:
    text = (
        "Publicado el 28 de agosto de 2026 a las 8:30 a. m. "
        "El artículo describe un caso de seguridad sin precisar cuándo ocurrió."
    )

    assert extractor.extract(text, datetime(2026, 8, 28, 8, 30)) is None


def test_rejects_incident_timestamp_after_publication(
    extractor: IncidentDateExtractor,
) -> None:
    publication = datetime(2026, 8, 28, 13, 0, tzinfo=timezone.utc)

    assert (
        extractor.extract(
            "El hecho ocurrió el 28 de agosto de 2026 a las 8:01.",
            publication,
        )
        is None
    )


def test_rejects_relative_today_time_after_publication(
    extractor: IncidentDateExtractor,
) -> None:
    assert (
        extractor.extract(
            "Hoy a las 18:46 se registró un hurto.",
            datetime(2026, 8, 29, 23, 45, tzinfo=timezone.utc),
        )
        is None
    )


def test_accepts_timestamp_equal_to_publication(
    extractor: IncidentDateExtractor,
) -> None:
    result = extractor.extract(
        "El hecho ocurrió el 28 de agosto de 2026 a las 8:00.",
        datetime(2026, 8, 28, 13, 0, tzinfo=timezone.utc),
    )

    assert result is not None
    assert result.value.isoformat() == "2026-08-28T08:00:00-05:00"


def test_rejects_editorial_timestamp_even_with_incident_later_in_sentence(
    extractor: IncidentDateExtractor,
) -> None:
    text = (
        "Actualizado el 28 de agosto de 2026 a las 8:30 a. m., "
        "el hecho ocurrió, pero la nota no indica cuándo."
    )

    assert extractor.extract(text, datetime(2026, 8, 28, 8, 30)) is None


def test_rejects_unlinked_date_even_when_complete(
    extractor: IncidentDateExtractor,
) -> None:
    assert (
        extractor.extract(
            "La reunión será el 26 de agosto de 2026 a las 20:30.",
            datetime(2026, 8, 25, 8, 0),
        )
        is None
    )


def test_omitted_year_never_jumps_back_more_than_one_year(
    extractor: IncidentDateExtractor,
) -> None:
    assert (
        extractor.extract(
            "El hecho ocurrió el 29 de febrero a las 18:45.",
            datetime(2026, 3, 1, 9, 0),
        )
        is None
    )


def test_omitted_year_can_use_immediately_previous_year(
    extractor: IncidentDateExtractor,
) -> None:
    result = extractor.extract(
        "El hecho ocurrió el 29 de febrero a las 18:45.",
        datetime(2025, 3, 1, 9, 0),
    )

    assert result is not None
    assert result.value.isoformat() == "2024-02-29T18:45:00-05:00"


def test_explicit_future_year_is_rejected_against_publication(
    extractor: IncidentDateExtractor,
) -> None:
    assert (
        extractor.extract(
            "El hecho ocurrió el 26 de agosto de 2027 a las 18:45.",
            datetime(2026, 8, 27, 9, 0),
        )
        is None
    )


def test_two_sentence_window_requires_clear_same_fact_evidence(
    extractor: IncidentDateExtractor,
) -> None:
    result = extractor.extract(
        "El ataque ocurrió el 26 de agosto de 2026. "
        "A las 20:30, la víctima fue agredida en la vía pública.",
        datetime(2026, 8, 27, 9, 0),
    )

    assert result is not None
    assert result.value.isoformat() == "2026-08-26T20:30:00-05:00"
    assert "El ataque ocurrió" in result.evidence
    assert "la víctima fue agredida" in result.evidence


def test_two_sentence_window_rejects_neighboring_unrelated_incidents(
    extractor: IncidentDateExtractor,
) -> None:
    assert (
        extractor.extract(
            "El robo ocurrió el 26 de agosto de 2026. "
            "Otro homicidio se registró a las 20:30 en una zona distinta.",
            datetime(2026, 8, 27, 9, 0),
        )
        is None
    )


def test_two_sentence_window_requires_incident_evidence_in_both_sentences(
    extractor: IncidentDateExtractor,
) -> None:
    assert (
        extractor.extract(
            "La fecha informada fue el 26 de agosto de 2026. "
            "A las 20:30, la víctima fue agredida en la vía pública.",
            datetime(2026, 8, 27, 9, 0),
        )
        is None
    )


def test_two_sentence_window_preserves_editorial_protection(
    extractor: IncidentDateExtractor,
) -> None:
    assert (
        extractor.extract(
            "Publicado el 26 de agosto de 2026, cuando el hecho ocurrió. "
            "A las 20:30, la víctima fue agredida en la vía pública.",
            datetime(2026, 8, 27, 9, 0),
        )
        is None
    )


def test_anoche_uses_previous_publication_day(
    extractor: IncidentDateExtractor,
) -> None:
    result = extractor.extract(
        "Anoche a las 22:15 se registró un hurto.",
        datetime(2026, 8, 29, 10, 0),
    )

    assert result is not None
    assert result.value.isoformat() == "2026-08-28T22:15:00-05:00"


def test_anoche_requires_publication_anchor(extractor: IncidentDateExtractor) -> None:
    assert extractor.extract("Anoche a las 22:15 ocurrió un hurto.", None) is None


def test_understands_numeric_date_and_unambiguous_natural_period(
    extractor: IncidentDateExtractor,
) -> None:
    result = extractor.extract(
        "El ataque ocurrió el 04/07/2026 a la 1 de la madrugada.",
        None,
    )

    assert result is not None
    assert result.value.isoformat() == "2026-07-04T01:00:00-05:00"


@pytest.mark.parametrize(
    "phrase",
    [
        "12 de la noche",
        "12 de la madrugada",
        "12:30 de la noche",
        "12:30 de la madrugada",
    ],
)
def test_rejects_ambiguous_twelve_at_night(
    extractor: IncidentDateExtractor,
    phrase: str,
) -> None:
    assert (
        extractor.extract(
            f"El ataque ocurrió el 04/07/2026 a las {phrase}.",
            None,
        )
        is None
    )


def test_invalid_calendar_date_is_rejected(extractor: IncidentDateExtractor) -> None:
    assert (
        extractor.extract(
            "El hecho ocurrió el 31 de febrero de 2026 a las 14:20.",
            None,
        )
        is None
    )
