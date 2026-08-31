"""Conservative extraction of locations explicitly stated in an article."""

from __future__ import annotations

import html
import re
import unicodedata
from dataclasses import dataclass


BOGOTA_LOCALITIES: tuple[str, ...] = (
    "Antonio Nariño",
    "Barrios Unidos",
    "Bosa",
    "Chapinero",
    "Ciudad Bolívar",
    "Engativá",
    "Fontibón",
    "Kennedy",
    "La Candelaria",
    "Los Mártires",
    "Puente Aranda",
    "Rafael Uribe Uribe",
    "San Cristóbal",
    "Santa Fe",
    "Suba",
    "Sumapaz",
    "Teusaquillo",
    "Tunjuelito",
    "Usaquén",
    "Usme",
)


@dataclass(frozen=True, slots=True)
class LocationExtraction:
    """Location fragments supported directly by article text.

    A neighborhood is preferred but optional when the article supplies an
    explicit street/intersection or a marked named sector. When the article
    states only a neighborhood, ``address`` keeps that verbatim phrase; this
    remains an approximate source-backed location, not an invented address.
    """

    address: str
    neighborhood: str | None
    locality: str | None
    evidence: str


_NEIGHBORHOOD_MARKER_RE = re.compile(
    r"\bbarrio(?:\s+de)?\s+[\"'“”‘’]?",
    re.IGNORECASE,
)

_NEIGHBORHOOD_BOUNDARY_RE = re.compile(
    r"(?:"
    r"\s+(?:de|en)\s+la\s+localidad\b"
    r"|\s+en\s+localidad\b"
    r"|\s+localidad\s+(?:de\s+)?\b"
    r"|\s+(?:donde|cuando|mientras|tras|durante|cerca\s+de|frente\s+a|sobre|junto\s+a)\b"
    r"|\s+(?:fue|eran?|esta|estan|ocurrio|ocurrieron|sucedio|se\s+registro|se\s+presento)\b"
    r"|\s+(?:ubicado|ubicada|ubicados|ubicadas)\b"
    r"|\s+al\s+(?:norte|sur|oriente|occidente)\b"
    r")",
    re.IGNORECASE,
)

_NAME_TOKEN_RE = re.compile(r"^[0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ][0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ'’-]*$")

_INVALID_NEIGHBORHOODS = {
    "bogota",
    "la ciudad",
    "esta ciudad",
    "la capital",
    "el sector",
    "la zona",
    "una zona",
    "la localidad",
    "esta localidad",
    "o localidad",
    "y localidad",
    "la victima",
    "el hecho",
    "los hechos",
    "donde",
}

_ROUTE = (
    r"(?:avenida\s+(?:calle|carrera)|avenida|av\.?|autopista|calle|cl\.?|"
    r"carrera|cra\.?|cr\.?|diagonal|diag\.?|transversal|tv\.?)"
)
_NAMED_ROUTE = (
    r"(?:caracas|boyac[aá]|n\.?q\.?s\.?|suba|ciudad\s+de\s+cali|"
    r"primero\s+de\s+mayo|las\s+am[eé]ricas|el\s+dorado|norte|sur)"
)
_NUMBERED_ROUTE = r"(?:\d{1,3}[A-Za-z]?(?:\s+bis)?(?:\s+(?:sur|este))?)"
_ROUTE_IDENTIFIER = rf"(?:{_NUMBERED_ROUTE}|{_NAMED_ROUTE})"

_INTERSECTION_RE = re.compile(
    rf"\b{_ROUTE}\s+{_ROUTE_IDENTIFIER}\s+"
    rf"(?:con|y|esquina\s+(?:con\s+)?)\s+"
    rf"{_ROUTE}\s+{_ROUTE_IDENTIFIER}\b",
    re.IGNORECASE,
)

_STREET_ADDRESS_RE = re.compile(
    rf"\b{_ROUTE}\s+{_ROUTE_IDENTIFIER}\s*"
    r"(?:#|n(?:[úu]mero|ro\.?|[.º°o]))\s*"
    r"\d{1,3}[A-Za-z]?(?:\s*[-–]\s*\d{1,3}[A-Za-z]?)?\b",
    re.IGNORECASE,
)

_HEIGHT_INTERSECTION_RE = re.compile(
    rf"\b{_ROUTE}\s+{_ROUTE_IDENTIFIER}\s*,?\s+"
    rf"a\s+la\s+altura\s+de\s+(?:la|el)\s+{_ROUTE}\s+{_ROUTE_IDENTIFIER}\b",
    re.IGNORECASE,
)

_NAMED_AREA_MARKER_RE = re.compile(
    r"\b(?:sector|zona)(?:\s+de)?\s+",
    re.IGNORECASE,
)

_NAMED_AREA_BOUNDARY_RE = re.compile(
    r"(?:"
    r"\s+(?:de|en)\s+la\s+localidad\b"
    r"|\s+en\s+localidad\b"
    r"|\s+localidad\s+(?:de\s+)?\b"
    r"|\s+en\s+Bogot[aá]\b"
    r"|\s+(?:donde|cuando|mientras|tras|durante|fue|ocurrio|sucedio|se\s+registro)\b"
    r")",
    re.IGNORECASE,
)

_LANDMARK_MARKER_RE = re.compile(
    r"\b(?:c[aá]rcel|estaci[oó]n(?:\s+de\s+TransMilenio)?|parque|hospital|"
    r"cl[ií]nica|universidad|colegio|centro\s+comercial|gimnasio)\s+",
    re.IGNORECASE,
)

_SENTENCE_BOUNDARY_RE = re.compile(
    r"(?:[!?]+|\.(?=\s+[A-ZÁÉÍÓÚÜÑ]))\s*"
)
_MAX_LOCATION_GAP = 280


def _clean_text(text: str | None) -> str:
    if not text:
        return ""
    return " ".join(html.unescape(str(text)).split())


def _fold(text: str) -> str:
    decomposed = unicodedata.normalize("NFKD", text.casefold())
    return "".join(character for character in decomposed if not unicodedata.combining(character))


def _clean_fragment(fragment: str) -> str:
    return " ".join(fragment.strip(" \t\r\n,;:.()[]{}\"'“”‘’").split())


class LocationExtractor:
    """Extract explicit Bogotá location evidence without geographic guesses."""

    localities = BOGOTA_LOCALITIES

    @staticmethod
    def contextual_locality(text: str) -> tuple[str, str] | None:
        """Return one locality explicitly introduced by ``en/localidad``.

        News headlines often state the locality while the incident paragraph
        supplies the finer-grained neighborhood. The pipeline may combine
        those two explicit facts only when this method finds one unambiguous
        locality name.
        """

        clean_text = _clean_text(text)
        folded_text = _fold(clean_text)
        matches: list[tuple[int, int, str]] = []
        for locality in BOGOTA_LOCALITIES:
            pattern = re.compile(
                rf"\b(?:en\s+(?:la\s+)?localidad(?:\s+de)?|"
                rf"localidad(?:\s+de)?|en)\s+{re.escape(_fold(locality))}\b"
            )
            for match in pattern.finditer(folded_text):
                matches.append((match.start(), match.end(), locality))

        names = {item[2] for item in matches}
        if len(names) != 1:
            return None
        start, end, locality = min(matches, key=lambda item: item[0])
        return locality, _clean_fragment(clean_text[start:end])

    def extract(self, text: str) -> LocationExtraction | None:
        clean_text = _clean_text(text)
        if not clean_text:
            return None

        neighborhoods = self._find_neighborhoods(clean_text)
        if not neighborhoods:
            return self._extract_without_neighborhood(clean_text)
        (
            neighborhood,
            neighborhood_evidence,
            neighborhood_position,
            neighborhood_end,
        ) = neighborhoods[0]

        localities = self._find_localities(clean_text)
        locality_result = self._nearest_locality(
            clean_text,
            neighborhood_position,
            neighborhood_end,
            neighborhoods,
            localities,
        )
        locality = locality_result[0] if locality_result else None

        address_result = self._nearest_address(
            clean_text,
            neighborhood_position,
            neighborhood_end,
            neighborhoods,
            localities,
            locality_result,
            self._find_addresses(clean_text),
        )
        address = address_result[0] if address_result else neighborhood_evidence

        evidence_parts: list[tuple[int, str]] = [
            (neighborhood_position, neighborhood_evidence)
        ]
        if locality_result:
            evidence_parts.append((locality_result[2], locality_result[1]))
        if address_result:
            evidence_parts.append((address_result[2], address_result[0]))

        evidence_parts.sort(key=lambda part: part[0])
        unique_evidence: list[str] = []
        seen: set[str] = set()
        for _, fragment in evidence_parts:
            key = _fold(fragment)
            if key not in seen:
                seen.add(key)
                unique_evidence.append(fragment)

        return LocationExtraction(
            address=address,
            neighborhood=neighborhood,
            locality=locality,
            evidence="; ".join(unique_evidence),
        )

    def _extract_without_neighborhood(
        self,
        text: str,
    ) -> LocationExtraction | None:
        """Accept only an explicit fine-grained address or marked named area."""

        candidates = [
            *self._find_addresses(text),
            *self._find_named_areas(text),
            *self._find_landmarks(text),
        ]
        if not candidates:
            return None
        address, address_evidence, position, _ = min(
            candidates,
            key=lambda item: item[2],
        )

        localities = self._find_localities(text)
        locality_names = {item[0] for item in localities}
        locality_result = localities[0] if len(locality_names) == 1 else None
        if locality_result is None:
            contextual = self.contextual_locality(text)
            if contextual is not None:
                locality, locality_evidence = contextual
                locality_position = _fold(text).find(_fold(locality_evidence))
                locality_result = (
                    locality,
                    locality_evidence,
                    max(locality_position, 0),
                    max(locality_position, 0) + len(locality_evidence),
                )

        evidence_parts = [(position, address_evidence)]
        if locality_result is not None:
            evidence_parts.append((locality_result[2], locality_result[1]))
        evidence_parts.sort(key=lambda item: item[0])
        evidence = "; ".join(dict.fromkeys(item[1] for item in evidence_parts))
        return LocationExtraction(
            address=address,
            neighborhood=None,
            locality=locality_result[0] if locality_result else None,
            evidence=evidence,
        )

    @staticmethod
    def _extract_neighborhood(text: str) -> tuple[str, str, int] | None:
        matches = LocationExtractor._find_neighborhoods(text)
        if not matches:
            return None
        neighborhood, evidence, position, _ = matches[0]
        return neighborhood, evidence, position

    @staticmethod
    def _find_neighborhoods(text: str) -> list[tuple[str, str, int, int]]:
        matches: list[tuple[str, str, int, int]] = []
        for marker in _NEIGHBORHOOD_MARKER_RE.finditer(text):
            tail = text[marker.end() : marker.end() + 140]

            punctuation = re.search(r"[,;.!?()\[\]\n]", tail)
            boundary = _NEIGHBORHOOD_BOUNDARY_RE.search(tail)
            endpoints = [
                match.start()
                for match in (punctuation, boundary)
                if match is not None
            ]
            candidate_text = tail[: min(endpoints)] if endpoints else tail
            candidate_text = _clean_fragment(candidate_text)
            candidate_text = candidate_text.rstrip("\"'“”‘’")

            tokens = candidate_text.split()
            if not 1 <= len(tokens) <= 6:
                continue
            if any(not _NAME_TOKEN_RE.fullmatch(token) for token in tokens):
                continue

            folded_candidate = _fold(candidate_text)
            if folded_candidate in _INVALID_NEIGHBORHOODS:
                continue
            if tokens[0].casefold() in {"un", "una", "este", "esta", "donde", "que"}:
                continue

            evidence_start = marker.start()
            evidence_end = marker.end() + len(candidate_text)
            evidence = _clean_fragment(text[evidence_start:evidence_end])
            matches.append((candidate_text, evidence, evidence_start, evidence_end))
        return matches

    @staticmethod
    def _extract_locality(text: str) -> tuple[str, str, int] | None:
        matches = LocationExtractor._find_localities(text)
        if not matches:
            return None
        locality, evidence, position, _ = matches[0]
        return locality, evidence, position

    @staticmethod
    def _find_localities(text: str) -> list[tuple[str, str, int, int]]:
        folded_text = _fold(text)
        matches: list[tuple[str, str, int, int]] = []
        for locality in BOGOTA_LOCALITIES:
            folded_locality = re.escape(_fold(locality))
            pattern = re.compile(
                rf"\blocalidad(?:\s+numero\s+\d+)?\s+(?:de\s+)?{folded_locality}\b"
            )
            for match in pattern.finditer(folded_text):
                evidence = _clean_fragment(text[match.start() : match.end()])
                matches.append((locality, evidence, match.start(), match.end()))

        return sorted(matches, key=lambda item: item[2])

    @staticmethod
    def _extract_address(text: str) -> tuple[str, str, int] | None:
        matches = LocationExtractor._find_addresses(text)
        if not matches:
            return None
        address, evidence, position, _ = matches[0]
        return address, evidence, position

    @staticmethod
    def _find_addresses(text: str) -> list[tuple[str, str, int, int]]:
        matches: list[re.Match[str]] = []
        for pattern in (_INTERSECTION_RE, _STREET_ADDRESS_RE, _HEIGHT_INTERSECTION_RE):
            matches.extend(pattern.finditer(text))
        if not matches:
            return []

        unique: dict[tuple[int, int], re.Match[str]] = {}
        for match in matches:
            unique[(match.start(), match.end())] = match
        ordered = sorted(
            unique.values(),
            key=lambda candidate: (candidate.start(), -len(candidate.group(0))),
        )
        return [
            (
                _clean_fragment(match.group(0)),
                _clean_fragment(match.group(0)),
                match.start(),
                match.end(),
            )
            for match in ordered
        ]

    @staticmethod
    def _find_named_areas(text: str) -> list[tuple[str, str, int, int]]:
        matches: list[tuple[str, str, int, int]] = []
        for marker in _NAMED_AREA_MARKER_RE.finditer(text):
            tail = text[marker.end() : marker.end() + 120]
            punctuation = re.search(r"[,;.!?()\[\]\n]", tail)
            boundary = _NAMED_AREA_BOUNDARY_RE.search(tail)
            endpoints = [
                match.start()
                for match in (punctuation, boundary)
                if match is not None
            ]
            name = _clean_fragment(tail[: min(endpoints)] if endpoints else tail)
            tokens = name.split()
            if not 1 <= len(tokens) <= 6:
                continue
            if any(not _NAME_TOKEN_RE.fullmatch(token) for token in tokens):
                continue
            if _fold(name) in _INVALID_NEIGHBORHOODS:
                continue
            start = marker.start()
            end = marker.end() + len(name)
            evidence = _clean_fragment(text[start:end])
            matches.append((evidence, evidence, start, end))
        return matches

    @staticmethod
    def _find_landmarks(text: str) -> list[tuple[str, str, int, int]]:
        matches: list[tuple[str, str, int, int]] = []
        for marker in _LANDMARK_MARKER_RE.finditer(text):
            tail = text[marker.end() : marker.end() + 100]
            punctuation = re.search(r"[,;.!?()\[\]\n]", tail)
            boundary = _NAMED_AREA_BOUNDARY_RE.search(tail)
            endpoints = [
                match.start()
                for match in (punctuation, boundary)
                if match is not None
            ]
            name = _clean_fragment(tail[: min(endpoints)] if endpoints else tail)
            tokens = name.split()
            if not 1 <= len(tokens) <= 6:
                continue
            if any(not _NAME_TOKEN_RE.fullmatch(token) for token in tokens):
                continue
            start = marker.start()
            end = marker.end() + len(name)
            landmark = _clean_fragment(text[start:end])
            matches.append((landmark, landmark, start, end))
        return matches

    @staticmethod
    def _nearest_locality(
        text: str,
        neighborhood_start: int,
        neighborhood_end: int,
        neighborhoods: list[tuple[str, str, int, int]],
        localities: list[tuple[str, str, int, int]],
    ) -> tuple[str, str, int, int] | None:
        neighborhood_sentence = _sentence_number(text, neighborhood_start)
        eligible = [
            match
            for match in localities
            if _sentence_number(text, match[2]) == neighborhood_sentence
            and _span_gap(
                neighborhood_start,
                neighborhood_end,
                match[2],
                match[3],
            )
            <= _MAX_LOCATION_GAP
            and not _has_intervening_neighborhood(
                neighborhood_start,
                match[2],
                neighborhoods,
                neighborhood_start,
            )
        ]
        if not eligible:
            return None
        return min(
            eligible,
            key=lambda match: (
                _span_gap(
                    neighborhood_start,
                    neighborhood_end,
                    match[2],
                    match[3],
                ),
                match[2],
            ),
        )

    @staticmethod
    def _nearest_address(
        text: str,
        neighborhood_start: int,
        neighborhood_end: int,
        neighborhoods: list[tuple[str, str, int, int]],
        localities: list[tuple[str, str, int, int]],
        selected_locality: tuple[str, str, int, int] | None,
        addresses: list[tuple[str, str, int, int]],
    ) -> tuple[str, str, int, int] | None:
        neighborhood_sentence = _sentence_number(text, neighborhood_start)
        eligible: list[tuple[int, int, tuple[str, str, int, int]]] = []
        for address in addresses:
            address_sentence = _sentence_number(text, address[2])
            sentence_distance = abs(address_sentence - neighborhood_sentence)
            gap = _span_gap(
                neighborhood_start,
                neighborhood_end,
                address[2],
                address[3],
            )
            if sentence_distance > 1 or gap > _MAX_LOCATION_GAP:
                continue
            if _has_intervening_neighborhood(
                neighborhood_start,
                address[2],
                neighborhoods,
                neighborhood_start,
            ):
                continue

            # An address in an adjacent sentence is only associated when that
            # sentence does not introduce a different explicit locality. This
            # keeps arrest/recovery locations from being attached to the
            # incident neighborhood mentioned immediately before them.
            if sentence_distance == 1:
                adjacent_localities = [
                    locality
                    for locality in localities
                    if _sentence_number(text, locality[2]) == address_sentence
                ]
                if adjacent_localities and (
                    selected_locality is None
                    or any(
                        _fold(locality[0]) != _fold(selected_locality[0])
                        for locality in adjacent_localities
                    )
                ):
                    continue

            eligible.append((sentence_distance, gap, address))

        if not eligible:
            return None
        return min(eligible, key=lambda item: (item[0], item[1], item[2][2]))[2]


def _sentence_number(text: str, position: int) -> int:
    return sum(1 for _ in _SENTENCE_BOUNDARY_RE.finditer(text, 0, position))


def _span_gap(
    first_start: int,
    first_end: int,
    second_start: int,
    second_end: int,
) -> int:
    if first_end < second_start:
        return second_start - first_end
    if second_end < first_start:
        return first_start - second_end
    return 0


def _has_intervening_neighborhood(
    first_position: int,
    second_position: int,
    neighborhoods: list[tuple[str, str, int, int]],
    selected_position: int,
) -> bool:
    lower, upper = sorted((first_position, second_position))
    return any(
        lower < candidate[2] < upper and candidate[2] != selected_position
        for candidate in neighborhoods
    )


__all__ = ["BOGOTA_LOCALITIES", "LocationExtraction", "LocationExtractor"]
