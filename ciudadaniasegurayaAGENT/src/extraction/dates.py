"""Conservative, deterministic incident date extraction for Spanish news.

This module extracts only timestamps stated in incident text. The pipeline may
apply the separately configured publication-date fallback and records that
choice explicitly in the evidence; it is never hidden inside this extractor.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from html import unescape
import re
import unicodedata
from zoneinfo import ZoneInfo
from typing import Literal


BOGOTA_TIMEZONE = ZoneInfo("America/Bogota")


@dataclass(frozen=True)
class DateExtraction:
    """An incident timestamp and the article fragment supporting it."""

    value: datetime
    evidence: str
    basis: Literal["incident_text", "publication_fallback"] = "incident_text"


@dataclass(frozen=True)
class _DateMention:
    start: int
    end: int
    value: date
    specificity: int


@dataclass(frozen=True)
class _TimeMention:
    start: int
    end: int
    value: time


_MONTHS = {
    "enero": 1,
    "febrero": 2,
    "marzo": 3,
    "abril": 4,
    "mayo": 5,
    "junio": 6,
    "julio": 7,
    "agosto": 8,
    "septiembre": 9,
    "setiembre": 9,
    "octubre": 10,
    "noviembre": 11,
    "diciembre": 12,
}

_WEEKDAYS = {
    "lunes": 0,
    "martes": 1,
    "miercoles": 2,
    "jueves": 3,
    "viernes": 4,
    "sabado": 5,
    "domingo": 6,
}

_MONTH_PATTERN = "|".join(_MONTHS)
_WEEKDAY_PATTERN = r"lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo"

_TEXTUAL_DATE_RE = re.compile(
    rf"""
    (?<!\d)
    (?P<day>0?[1-9]|[12]\d|3[01])
    \s+de\s+
    (?P<month>{_MONTH_PATTERN})
    (?:\s*(?:(?:de|del)\s+|,\s*)(?P<year>\d{{4}}))?
    (?!\d)
    """,
    re.IGNORECASE | re.VERBOSE,
)

_NUMERIC_DATE_RE = re.compile(
    r"(?<!\d)(?P<day>0?[1-9]|[12]\d|3[01])\s*[/.-]\s*"
    r"(?P<month>0?[1-9]|1[0-2])\s*[/.-]\s*(?P<year>\d{4})(?!\d)"
)

_ISO_DATE_RE = re.compile(
    r"(?<!\d)(?P<year>\d{4})-(?P<month>0[1-9]|1[0-2])-"
    r"(?P<day>0[1-9]|[12]\d|3[01])(?!\d)"
)

_RELATIVE_DATE_RE = re.compile(
    r"\b(?P<relative>anteayer|anoche|ayer|hoy)\b",
    re.IGNORECASE,
)

_WEEKDAY_DATE_RE = re.compile(
    rf"""
    \b(?:
        (?:el\s+)?(?P<prefix>este|esta|pasado|pasada)\s+
        (?P<prefix_day>{_WEEKDAY_PATTERN})
        |
        (?:el\s+)?(?P<suffix_day>{_WEEKDAY_PATTERN})\s+
        (?P<suffix>pasado|pasada)
    )\b
    """,
    re.IGNORECASE | re.VERBOSE,
)

_MERIDIEM_PATTERN = r"a\s*\.?\s*m\s*\.?|p\s*\.?\s*m\s*\.?"
_NATURAL_PERIOD_PATTERN = r"de\s+la\s+(?:ma(?:ñ|n)ana|tarde|noche|madrugada)"
_PERIOD_PATTERN = rf"{_MERIDIEM_PATTERN}|{_NATURAL_PERIOD_PATTERN}"
_TIME_MARKER_PATTERN = r"(?:a|hacia|sobre)\s+(?:eso\s+de\s+)?(?:la|las)\s+"

# A clock with a colon is only useful as an event time when Spanish syntax
# actually marks it as one: ``a/hacia/sobre las HH:MM`` or an explicit
# ``a. m./p. m./horas`` suffix.  This prevents durations, scores and other bare
# numeric pairs from silently becoming incident timestamps.  The few broader
# candidates admitted by the regex are discarded deterministically in
# ``_find_times`` below.
_TIME_RE = re.compile(
    rf"""
    (?<![\w:])(?:
        (?P<colon_marker>{_TIME_MARKER_PATTERN})?
        (?P<colon_hour>2[0-3]|[01]?\d)\s*:\s*(?P<colon_minute>[0-5]\d)
        (?:\s*(?P<colon_period>{_PERIOD_PATTERN}))?
        (?P<colon_hours_suffix>\s+horas?)?
        |
        (?P<period_marker>{_TIME_MARKER_PATTERN})?
        (?P<period_hour>1[0-2]|0?[1-9])
        (?:\s*:\s*(?P<period_minute>[0-5]\d))?
        \s*(?P<period>{_PERIOD_PATTERN})
        |
        (?P<hours_marker>{_TIME_MARKER_PATTERN})?
        (?P<hours_hour>2[0-3]|[01]?\d)
        (?:\s*:\s*(?P<hours_minute>[0-5]\d))?\s+horas?
    )(?!\d)
    """,
    re.IGNORECASE | re.VERBOSE,
)

# A valid-looking clock can still describe elapsed time, a range or a bound
# rather than the moment of an incident.  These expressions are deliberately
# rejected instead of choosing an endpoint or treating a duration as wall
# clock time.
_CLOCK_FRAGMENT_PATTERN = rf"""
    (?:{_TIME_MARKER_PATTERN}|(?:la|las)\s+)?
    (?:2[0-3]|[01]?\d)\s*:\s*[0-5]\d
    (?:\s*(?:{_PERIOD_PATTERN})|\s+horas?)?
"""

_INTERVAL_RE = re.compile(
    rf"""
    \b(?:entre|desde|de)\s+
    {_CLOCK_FRAGMENT_PATTERN}
    \s*(?:y|e|o|a|hasta|[-–—])\s*
    {_CLOCK_FRAGMENT_PATTERN}
    """,
    re.IGNORECASE | re.VERBOSE,
)

_DURATION_PREFIX_RE = re.compile(
    r"""
    (?:
        durante|por|dur[oó]|duraron|tard[oó]|demor[oó]|transcurrieron|
        (?:con\s+)?(?:una\s+)?duraci[oó]n\s+de|lapso\s+de|intervalo\s+de
    )
    \s*(?:(?:aproximadamente|cerca\s+de|m[aá]s\s+de|menos\s+de)\s*)?$
    """,
    re.IGNORECASE | re.VERBOSE,
)

_DURATION_SUFFIX_RE = re.compile(
    r"^\s*(?:de\s+duraci[oó]n|continuas?|seguidas?)\b",
    re.IGNORECASE,
)

_BOUND_PREFIX_RE = re.compile(
    r"""
    (?:
        (?:poco\s+|minutos?\s+|horas?\s+)?(?:antes|despu[eé]s)\s+de|
        a\s+partir\s+de|hasta|a\s+m[aá]s\s+tardar|no\s+m[aá]s\s+tarde\s+de|
        como\s+m[aá]ximo(?:\s+a)?|l[ií]mite(?:\s+(?:de|era|fue))?|
        plazo(?:\s+(?:hasta|de))?
    )
    \s*(?:a\s+)?(?:la|las)?\s*$
    """,
    re.IGNORECASE | re.VERBOSE,
)

_INCIDENT_RE = re.compile(
    r"""
    \b(?:el\s+hecho|los\s+hechos)\b
    |\b(?:ocurri[oó]|ocurrieron|ocurrid[oa]s?|sucedi[oó]|sucedieron|aconteci[oó]|
        acontecieron|pas[oó]|se\s+produjo)\b
    |\bse\s+(?:registr[oó]|registraron|report[oó]|reportaron|present[oó]|
        presentaron)\b
    |\bfue(?:ron)?\s+(?:asesinad[oa]s?|atacad[oa]s?|agredid[oa]s?|rob[ao]d[oa]s?|
        hurtad[oa]s?|atracad[oa]s?|herid[oa]s?|capturad[oa]s?|arrollad[oa]s?)\b
    |\b(?:asesinaron|atacaron|agredieron|robaron|hurtaron|atracaron|capturaron|
        arrollaron|colision[oó]|muri[oó])\b
    |\bresult[oó]\s+herid[oa]\b
    |\bfue\s+v[ií]ctima\s+de\b
    """,
    re.IGNORECASE | re.VERBOSE,
)

_EDITORIAL_RE = re.compile(
    r"\b(?:fecha\s+de\s+publicaci[oó]n|publicad[oa]s?|actualizad[oa]s?|"
    r"última\s+actualizaci[oó]n|redacci[oó]n|editad[oa]s?|modificad[oa]s?)\b",
    re.IGNORECASE,
)

# A two-sentence window is considered only when the second sentence clearly
# continues the first incident.  Merely placing two different crime reports
# next to one another is not sufficient temporal evidence.
_CONTINUITY_RE = re.compile(
    r"""
    \b(?:
        (?:este|esta|ese|esa|aquel|aquella|dicho|dicha|el\s+mismo|la\s+misma)
        \s+(?:hecho|caso|incidente|ataque|robo|hurto|atraco|homicidio|agresi[oó]n|crimen)
        |
        (?:el|los)\s+hechos?
        |
        (?:la|las)\s+v[ií]ctimas?
        |
        (?:el|la|los|las)\s+afectad[oa]s?
        |
        (?:el|los)\s+responsables?
        |
        (?:el|la)\s+(?:ataque|robo|hurto|atraco|homicidio|agresi[oó]n|crimen)
    )\b
    """,
    re.IGNORECASE | re.VERBOSE,
)

_SENTENCE_BREAK_RE = re.compile(
    r"\n+|(?<=[!?])\s+|(?<=\.)\s+(?=[A-ZÁÉÍÓÚÜÑ¿¡“\"]|$)"
)

_MAX_DATE_TIME_DISTANCE = 140
_MAX_INCIDENT_DISTANCE = 180


def _plain(value: str) -> str:
    """Return a lowercase, accent-insensitive lookup key."""

    decomposed = unicodedata.normalize("NFD", value.casefold())
    return "".join(
        character
        for character in decomposed
        if unicodedata.category(character) != "Mn"
    )


def _normalize_text(text: str) -> str:
    text = re.sub(r"<[^>]+>", " ", unescape(text))
    text = text.replace("\xa0", " ").replace("\u202f", " ")
    text = re.sub(r"[\t\r\f\v ]+", " ", text)
    text = re.sub(r" *\n+ *", "\n", text)
    return text.strip()


def _local_anchor(publication_date: datetime | None) -> datetime | None:
    if not isinstance(publication_date, datetime):
        return None
    if publication_date.tzinfo is None or publication_date.utcoffset() is None:
        return publication_date.replace(tzinfo=BOGOTA_TIMEZONE)
    return publication_date.astimezone(BOGOTA_TIMEZONE)


def _span_distance(first_start: int, first_end: int, second_start: int, second_end: int) -> int:
    if first_end < second_start:
        return second_start - first_end
    if second_end < first_start:
        return first_start - second_end
    return 0


def _safe_date(year: int, month: int, day: int) -> date | None:
    try:
        return date(year, month, day)
    except ValueError:
        return None


def _infer_year(day: int, month: int, anchor: date) -> date | None:
    """Resolve a missing year without silently jumping across multiple years.

    A day/month mention in a news article can reasonably refer to the
    publication year or, around New Year (and for 29 February), the immediately
    preceding year.  Going farther back would be an unsupported inference.
    """

    for year in (anchor.year, anchor.year - 1):
        candidate = _safe_date(year, month, day)
        if candidate is not None and candidate <= anchor:
            return candidate
    return None


def _find_dates(segment: str, anchor: datetime | None) -> list[_DateMention]:
    mentions: list[_DateMention] = []
    anchor_date = anchor.date() if anchor is not None else None

    for pattern in (_ISO_DATE_RE, _NUMERIC_DATE_RE):
        for match in pattern.finditer(segment):
            candidate = _safe_date(
                int(match.group("year")),
                int(match.group("month")),
                int(match.group("day")),
            )
            if candidate is not None:
                mentions.append(_DateMention(match.start(), match.end(), candidate, 0))

    for match in _TEXTUAL_DATE_RE.finditer(segment):
        day = int(match.group("day"))
        month = _MONTHS[_plain(match.group("month"))]
        year_text = match.group("year")
        if year_text is not None:
            candidate = _safe_date(int(year_text), month, day)
            specificity = 0
        elif anchor_date is not None:
            candidate = _infer_year(day, month, anchor_date)
            specificity = 1
        else:
            candidate = None
            specificity = 1
        if candidate is not None:
            mentions.append(_DateMention(match.start(), match.end(), candidate, specificity))

    if anchor_date is not None:
        relative_offsets = {"hoy": 0, "ayer": 1, "anoche": 1, "anteayer": 2}
        for match in _RELATIVE_DATE_RE.finditer(segment):
            offset = relative_offsets[_plain(match.group("relative"))]
            mentions.append(
                _DateMention(match.start(), match.end(), anchor_date - timedelta(days=offset), 2)
            )

        for match in _WEEKDAY_DATE_RE.finditer(segment):
            weekday_text = match.group("prefix_day") or match.group("suffix_day")
            modifier = match.group("prefix") or match.group("suffix")
            target_weekday = _WEEKDAYS[_plain(weekday_text)]
            elapsed_days = (anchor_date.weekday() - target_weekday) % 7
            if _plain(modifier).startswith("pasad") and elapsed_days == 0:
                elapsed_days = 7
            candidate = anchor_date - timedelta(days=elapsed_days)
            mentions.append(_DateMention(match.start(), match.end(), candidate, 3))

    # Prefer the more explicit interpretation when two forms overlap, as in
    # "este martes 26 de agosto de 2026".
    mentions.sort(key=lambda mention: (mention.start, mention.specificity, -mention.end))
    deduplicated: list[_DateMention] = []
    for mention in mentions:
        if any(
            mention.start < existing.end and existing.start < mention.end
            for existing in deduplicated
        ):
            continue
        deduplicated.append(mention)
    return deduplicated


def _period_to_24_hour(hour: int, period: str | None) -> int | None:
    if period is None:
        return hour

    normalized = _plain(re.sub(r"[.\s]", "", period))
    if hour == 12 and normalized in {"delanoche", "delamadrugada"}:
        # In ordinary reporting these expressions are used inconsistently for
        # both the beginning and the end of the night.  Only 12 a. m./p. m. is
        # precise enough to keep.
        return None
    if normalized in {"am", "delamanana", "delamadrugada"}:
        if not 1 <= hour <= 12:
            return None
        return 0 if hour == 12 else hour
    if normalized in {"pm", "delatarde", "delanoche"}:
        if not 1 <= hour <= 12:
            return None
        return hour if hour == 12 else hour + 12
    return None


def _find_times(segment: str) -> list[_TimeMention]:
    mentions: list[_TimeMention] = []
    interval_spans = [match.span() for match in _INTERVAL_RE.finditer(segment)]

    for match in _TIME_RE.finditer(segment):
        if any(
            match.start() < interval_end and interval_start < match.end()
            for interval_start, interval_end in interval_spans
        ):
            continue

        before = segment[max(0, match.start() - 80) : match.start()]
        after = segment[match.end() : min(len(segment), match.end() + 35)]
        if (
            _DURATION_PREFIX_RE.search(before)
            or _DURATION_SUFFIX_RE.search(after)
            or _BOUND_PREFIX_RE.search(before)
        ):
            continue

        if match.group("colon_hour") is not None:
            hour = int(match.group("colon_hour"))
            minute = int(match.group("colon_minute"))
            period = match.group("colon_period")
            marker = match.group("colon_marker")
            hours_suffix = match.group("colon_hours_suffix")

            normalized_period = (
                _plain(re.sub(r"[.\s]", "", period)) if period is not None else None
            )
            has_meridiem = normalized_period in {"am", "pm"}
            if marker is None and hours_suffix is None and not has_meridiem:
                continue
        elif match.group("period_hour") is not None:
            hour = int(match.group("period_hour"))
            minute = int(match.group("period_minute") or 0)
            period = match.group("period")
        else:
            hour = int(match.group("hours_hour"))
            minute = int(match.group("hours_minute") or 0)
            period = None

        hour_24 = _period_to_24_hour(hour, period)
        if hour_24 is not None:
            mentions.append(
                _TimeMention(match.start(), match.end(), time(hour=hour_24, minute=minute))
            )
    return mentions


def _same_incident_window(first: str, second: str) -> bool:
    """Return whether two adjacent sentences explicitly describe one fact."""

    if _INCIDENT_RE.search(first) is None or _INCIDENT_RE.search(second) is None:
        return False

    # A continuity expression near the beginning of sentence two ties its
    # clock/date back to the preceding incident.  Looking only at the opening
    # keeps a later, unrelated reference from legitimizing the join.
    return _CONTINUITY_RE.search(second[:160]) is not None


def _extract_from_segment(
    segment: str,
    anchor: datetime | None,
) -> DateExtraction | None:
    dates = _find_dates(segment, anchor)
    times = _find_times(segment)
    incidents = list(_INCIDENT_RE.finditer(segment))
    if not dates or not times or not incidents:
        return None
    editorials = list(_EDITORIAL_RE.finditer(segment))

    candidates: list[tuple[int, int, int, _DateMention, _TimeMention]] = []
    for date_mention in dates:
        for time_mention in times:
            date_time_distance = _span_distance(
                date_mention.start,
                date_mention.end,
                time_mention.start,
                time_mention.end,
            )
            if date_time_distance > _MAX_DATE_TIME_DISTANCE:
                continue

            pair_start = min(date_mention.start, time_mention.start)
            pair_end = max(date_mention.end, time_mention.end)
            incident_distance = min(
                _span_distance(pair_start, pair_end, match.start(), match.end())
                for match in incidents
            )
            if incident_distance > _MAX_INCIDENT_DISTANCE:
                continue

            if editorials:
                directly_attached_to_editorial = any(
                    (
                        match.end() <= pair_start
                        and pair_start - match.end() <= 30
                    )
                    or (
                        match.start() >= pair_end
                        and match.start() - pair_end <= 12
                    )
                    for match in editorials
                )
                if directly_attached_to_editorial:
                    continue

                editorial_distance = min(
                    _span_distance(pair_start, pair_end, match.start(), match.end())
                    for match in editorials
                )
                # A timestamp more closely attached to "publicado" or
                # "actualizado" is editorial metadata, even if another part
                # of the sentence happens to mention an incident.
                if editorial_distance <= incident_distance:
                    continue

            value = datetime.combine(
                date_mention.value,
                time_mention.value,
                tzinfo=BOGOTA_TIMEZONE,
            )
            if anchor is not None and value > anchor:
                # Publication metadata is an upper bound for explicit event
                # text. Any authorized fallback is applied by the pipeline.
                continue

            association_score = incident_distance + date_time_distance
            candidates.append(
                (
                    association_score,
                    date_mention.specificity,
                    pair_start,
                    date_mention,
                    time_mention,
                )
            )

    if not candidates:
        return None

    _, _, _, chosen_date, chosen_time = min(candidates, key=lambda item: item[:3])
    value = datetime.combine(
        chosen_date.value,
        chosen_time.value,
        tzinfo=BOGOTA_TIMEZONE,
    )
    return DateExtraction(value=value, evidence=segment)


class IncidentDateExtractor:
    """Extract a well-supported incident timestamp from Spanish article text.

    The extractor intentionally returns ``None`` when either an explicit date,
    an explicit time, or a nearby incident phrase is absent.  This favors
    precision over recall and prevents publication metadata from becoming an
    invented incident timestamp.
    """

    def extract(
        self,
        text: str,
        publication_date: datetime | None,
    ) -> DateExtraction | None:
        if not isinstance(text, str) or not text.strip():
            return None

        normalized = _normalize_text(text)
        anchor = _local_anchor(publication_date)
        segments = [
            segment.strip()
            for segment in _SENTENCE_BREAK_RE.split(normalized)
            if segment.strip()
        ]

        # Prefer self-contained evidence.  Cross-sentence association is a
        # conservative fallback and is never allowed to override a complete
        # sentence later in the article.
        for segment in segments:
            result = _extract_from_segment(segment, anchor)
            if result is not None:
                return result

        for first, second in zip(segments, segments[1:]):
            if not _same_incident_window(first, second):
                continue
            result = _extract_from_segment(f"{first} {second}", anchor)
            if result is not None:
                return result

        return None


__all__ = ["DateExtraction", "IncidentDateExtractor"]
