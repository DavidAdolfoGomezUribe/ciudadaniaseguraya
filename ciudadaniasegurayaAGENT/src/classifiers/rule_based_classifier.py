"""Conservative, deterministic incident classification.

This module is intentionally independent from the source adapters.  It is the
Iteration 1 baseline that can later be replaced by an agent without changing
the scraping layer.
"""

from __future__ import annotations

import html
import re
import unicodedata
from collections.abc import Iterable


SUPPORTED_INCIDENT_TYPES: tuple[str, ...] = (
    "atraco",
    "robo",
    "hurto",
    "homicidio",
    "agresion",
    "secuestro",
    "extorsion",
    "violencia_sexual",
    "violencia_intrafamiliar",
    "vandalismo",
    "otro",
)


# More specific, multi-word categories come first when two expressions start
# at the same position.  Importantly, robbery terms are not aliases for hurto:
# every result is one of the backend's own enum values.
_CATEGORY_PATTERNS: dict[str, tuple[re.Pattern[str], ...]] = {
    "violencia_intrafamiliar": (
        re.compile(r"\bviolencia\s+(?:intrafamiliar|domestica|familiar)\b"),
        re.compile(r"\bmaltrato\s+(?:intrafamiliar|domestico|familiar)\b"),
    ),
    "violencia_sexual": (
        re.compile(r"\bviolencia\s+sexual\b"),
        re.compile(r"\b(?:abuso|agresion|delito)\s+sexual(?:es)?\b"),
        re.compile(r"\bacceso\s+carnal(?:\s+violento)?\b"),
        re.compile(r"\bviolacion(?:es)?\b"),
        re.compile(r"\bviol(?:o|aron|ada|ado)\b"),
    ),
    "homicidio": (
        re.compile(r"\bhomicidios?\b"),
        re.compile(r"\b(?:asesinato|feminicidio)s?\b"),
        re.compile(r"\bsicariatos?\b"),
        re.compile(r"\bataques?\s+sicarial(?:es)?\b"),
        re.compile(
            r"\bataque\b.{0,80}\b(?:murio|murieron|fallecio|fallecieron)\b"
        ),
        re.compile(
            r"\batentado\b.{0,120}\b(?:deja|dejo)\b.{0,60}\bmuert[oa]s?\b"
        ),
        re.compile(r"\basesin(?:aron|ado|ada|ados|adas|o)\b"),
        re.compile(r"\b(?:mataron|matado|matada|mato)\b"),
        re.compile(r"\bcaus(?:andole|o)\s+la\s+muerte\b"),
    ),
    "secuestro": (
        re.compile(r"\bsecuestros?\b"),
        re.compile(r"\bsecuestr(?:aron|ado|ada|ados|adas|o)\b"),
    ),
    "extorsion": (
        re.compile(r"\bextorsiones?\b"),
        re.compile(r"\bextorsion(?:aron|ado|ada|ados|adas|o)\b"),
    ),
    "atraco": (
        re.compile(r"\batracos?\b"),
        re.compile(r"\batrac(?:aron|ado|ada|ados|adas|o)\b"),
        re.compile(r"\basalto\s+(?:a|contra)\s+(?:un|una|el|la)\b"),
    ),
    "robo": (
        re.compile(r"\brobos?\b"),
        re.compile(r"\brobar\b"),
        re.compile(r"\brob(?:aron|ado|ada|ados|adas|o)\b"),
    ),
    "hurto": (
        re.compile(r"\bhurtos?\b"),
        re.compile(r"\bhurtar\b"),
        re.compile(r"\bhurt(?:aron|ado|ada|ados|adas|o)\b"),
        re.compile(r"\bapartamenteros?\b"),
    ),
    "agresion": (
        re.compile(r"\bintento\s+de\s+feminicidio\b"),
        re.compile(r"\bagresion(?:es)?\b"),
        re.compile(r"\bagredi(?:o|eron|do|da|dos|das)\b"),
        re.compile(r"\bataque\s+(?:a|contra)\s+(?:un|una|el|la)\b"),
        re.compile(r"\blesiones\s+personales\b"),
    ),
    "vandalismo": (
        re.compile(r"\bvandalismo\b"),
        re.compile(r"\bvandaliz(?:aron|ado|ada|ados|adas|o)\b"),
        re.compile(r"\bdanos?\s+(?:intencionales?\s+)?(?:a|contra)\s+(?:bienes|propiedad)\b"),
    ),
    # The backend has no dedicated enum for the following explicit event
    # families, even though Iteration 1 names fires and crashes as valid
    # individual incidents. They map deterministically to its supported
    # catch-all value; no unknown type is ever emitted.
    "otro": (
        re.compile(r"\bfuga\s+de\s+presos?\b"),
        re.compile(r"\bincendios?\b"),
        re.compile(r"\b(?:explosion|explosiones)\b"),
        re.compile(
            r"\bataque\s+con\s+(?:un\s+)?(?:artefacto\s+explosivo|granada)\b"
        ),
        re.compile(r"\baccidentes?\s+(?:de\s+)?transito\b"),
        re.compile(r"\bsiniestros?\s+viales?\b"),
    ),
}

_CATEGORY_PRIORITY = {name: index for index, name in enumerate(_CATEGORY_PATTERNS)}


_NON_INCIDENT_RE = re.compile(
    r"(?:"
    r"\b(?:campana|estrategia|programa|jornada)\s+(?:de\s+)?(?:prevencion|preventiva|sensibilizacion)\b"
    r"|\b(?:prevencion|prevenir)\s+(?:del?|un|una|los|las)?\s*(?:hurto|robo|atraco|homicidio|agresion|secuestro|extorsion|vandalismo)"
    r"|\b(?:consejos|recomendaciones|tips|guia|claves)\s+(?:de|para|sobre)\b"
    r"|\bcomo\s+(?:evitar|prevenir|protegerse|denunciar)\b"
    r"|\b(?:balance|boletin|informe)\s+(?:mensual|semanal|trimestral|semestral|anual|de\s+seguridad|de\s+gestion)\b"
    r"|\b(?:estadisticas?|cifras?|indicadores?|tasa)\s+(?:de|sobre)\b"
    r"|\b(?:aumentan?|aumento|incremento|disminuyen?|disminucion|reduccion)\s+(?:de\s+|los\s+|las\s+|el\s+|la\s+)?(?:casos\s+de\s+)?(?:hurtos?|robos?|atracos?|homicidios?|agresiones?|secuestros?|extorsiones?)\b"
    r"|\b(?:delitos?|casos)\s+(?:que\s+)?(?:mas|menos)\s+(?:aumentan|disminuyen|frecuentes)\b"
    r"|\b(?:politica|decreto|proyecto\s+de\s+ley)\s+(?:publica\s+)?(?:contra|sobre|para)\b"
    r"|\boperativo\s+preventivo\b"
    r")"
)


_EVENT_ACTION_RE = re.compile(
    r"(?:"
    r"\b(?:ocurrio|ocurrid[oa]s?|sucedio|acontecio)\b"
    r"|\b(?:se\s+)?(?:registro|reporto|presento)\s+(?:un|una|el|la|este|esta)\b"
    r"|\b(?:los\s+)?hechos?\s+(?:ocurrieron|se\s+registraron|sucedieron)\b"
    r"|\bfue\s+(?:victima|asesinad[oa]|secuestrad[oa]|agredid[oa]|atacad[oa]|"
    r"herid[oa]|lesionad[oa]|apun?alad[oa]|balead[oa]|hallad[oa]\s+sin\s+vida)\b"
    r"|\b(?:resulto|quedo)\s+(?:herid[oa]|lesionad[oa])\b"
    r"|\bdeja(?:ron)?\s+(?:un|una|\d+)\s+(?:muert[oa]s?|herid[oa]s?)\b"
    r"|\b(?:deja|dejo)\b.{0,60}\bmuert[oa]s?\b"
    r"|\b(?:perdio\s+la\s+vida|hallaron\s+(?:un\s+)?cuerpo)\b"
    r"|\b(?:murio|murieron|fallecio|fallecieron)\b"
    r"|\b(?:termino|derivo)\s+en\s+(?:un|una|el|la)?\s*"
    r"|\b(?:capturo|capturaron|capturad[oa]s?|detuvo|detuvieron|detenid[oa]s?|"
    r"aprehendid[oa]s?|judicializad[oa]s?|condenad[oa]s?)\b"
    r"|\b(?:investigan|buscan)\s+(?:al?|a\s+los|a\s+las|a\s+un|a\s+una|a\s+quien)\b"
    r"|\b(?:denuncio|denunciaron)\b"
    r"|\b(?:atracaron|atracad[oa]s?|robaron|robad[oa]s?|hurtaron|hurtad[oa]s?|asesinaron|asesinad[oa]s?|mataron|matad[oa]s?|secuestraron|secuestrad[oa]s?|extorsionaron|extorsionad[oa]s?|agredieron|agredid[oa]s?|vandalizaron|vandalizad[oa]s?)\b"
    r"|\b(?:se\s+incendio|exploto|estallo|choco|colisiono|se\s+accidento)\b"
    r"|\b(?:un|el)\s+ataque\s+con\s+(?:un\s+)?"
    r"(?:artefacto\s+explosivo|granada)\s+se\s+registro\b"
    r"|\b(?:un|el|una|la)\s+(?:incendio|explosion|accidente)\s+"
    r"(?:se\s+)?(?:registro|ocurrio|sucedio)\b"
    r")"
)

# Keeping the accented spelling lets us distinguish the past-tense verb "robó"
# from the noun "robo" before diacritics are removed for the other rules.
_ACCENTED_ACTION_RE = re.compile(
    r"\b(?:robó|hurtó|atracó|asesinó|mató|secuestró|extorsionó|agredió|vandalizó|violó)\b",
    re.IGNORECASE,
)

_SUBJECT_OR_CASE_RE = re.compile(
    r"(?:"
    r"\b(?:un|una|dos|tres|cuatro)\s+(?:hombre|mujer|persona|joven|menor|comerciante|conductor|taxista|ciudadano|ciudadana|policia|vigilante)s?\b"
    r"|\b(?:la|el|una|un)\s+victima\b"
    r"|\bcaso\s+(?:de|ocurrido|reportado)\b"
    r"|\b(?:este|el)\s+(?:hecho|crimen|delito)\b"
    r"|\ba\s+mano\s+armada\b"
    r")"
)

_BOGOTA_LOCALITIES_RE = re.compile(
    r"\b(?:antonio\s+narino|barrios\s+unidos|bosa|chapinero|ciudad\s+bolivar|engativa|fontibon|kennedy|la\s+candelaria|los\s+martires|puente\s+aranda|rafael\s+uribe\s+uribe|san\s+cristobal|santa\s+fe|suba|sumapaz|teusaquillo|tunjuelito|usaquen|usme)\b"
)

_SPECIFIC_CONTEXT_RE = re.compile(
    r"(?:"
    r"\b(?:barrio|localidad|sector|calle|carrera|avenida|diagonal|transversal|parque|estacion)\s+[\w#-]+"
    r"|\b(?:este|el\s+pasado|la\s+pasada)\s+(?:lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b"
    r"|\b(?:anoche|ayer|madrugada|noche)\b"
    r"|\b\d{1,2}\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b"
    r"|\b(?:transmilenio|sitp)\b"
    r")"
)

_DISCOVERY_CRIME_RE = re.compile(
    r"\b(?:ladrones?|delincuentes?|apartamenteros?|sicarios?|criminales?|"
    r"capturad[oa]s?|detenid[oa]s?|asesinad[oa]s?|víctimas?)\b",
    re.IGNORECASE,
)

# A recovered/seized/dismantled object described as ``hurtado`` or ``robado``
# proves the object's status, but not that the theft happened at the recovery
# location. It cannot by itself support an incident payload for that place.
_PROPERTY_STATUS_RE = re.compile(
    r"\b(?:recuper(?:o|aron|ado|ada|ados|adas)|incaut(?:o|aron|ado|ada|ados|adas)|"
    r"hall(?:o|aron|ado|ada|ados|adas)|encontr(?:o|aron|ado|ada|ados|adas)|"
    r"captur(?:o|aron|ado|ada|ados|adas)|"
    r"desguaz(?:aba|aban|o|aron)|rastre(?:aba|aban|o|aron|ar)|"
    r"ubic(?:o|aron|ado|ada|ados|adas|ar|aba|aban)|"
    r"reportad[oa]s?|tenia|tenian|portaba|portaban|"
    r"se\s+movilizaba|se\s+movilizaban)\b.{0,180}"
    r"\b(?:hurtad[oa]s?|robad[oa]s?)\b"
)

_DIRECT_PROPERTY_INCIDENT_RE: dict[str, re.Pattern[str]] = {
    "hurto": re.compile(
        r"\b(?:hurt(?:ar|aron|aba|aban)|comet(?:io|ieron)\s+(?:un\s+)?hurto|"
        r"victima\s+de\s+(?:un\s+)?hurto|hurto\s+(?:ocurrio|se\s+registro))\b"
    ),
    "robo": re.compile(
        r"\b(?:rob(?:ar|aron|aba|aban)|comet(?:io|ieron)\s+(?:un\s+)?robo|"
        r"victima\s+de\s+(?:un\s+)?robo|robo\s+(?:ocurrio|se\s+registro)|"
        r"frustro\s+(?:un\s+)?robo)\b"
    ),
}

_ACCENTED_PROPERTY_ACTION_RE: dict[str, re.Pattern[str]] = {
    "hurto": re.compile(r"\bhurtó\b", re.IGNORECASE),
    "robo": re.compile(r"\brobó\b", re.IGNORECASE),
}

_ARREST_ACTION_RE = re.compile(
    r"\b(?:captur(?:o|aron|ado|ada|ados|adas)|detuv(?:o|ieron)|"
    r"detenid[oa]s?|aprehendid[oa]s?)\b"
)

_EXPLICIT_OCCURRENCE_RE = re.compile(
    r"\b(?:ocurrio|ocurrieron|sucedio|sucedieron|"
    r"se\s+registro|se\s+registraron|los\s+hechos|el\s+hecho)\b"
)

_PRESUMED_INVOLVEMENT_RE = re.compile(
    r"\b(?:presunt[oa]\s+)?participacion\s+en\s+(?:un\s+)?(?:hurto|robo)\b"
    r"|\bsenalad[oa]s?\s+de\s+participar\s+en\s+(?:el|un)\s+(?:hurto|robo)\b"
)


def _clean(value: str | None) -> str:
    """Decode HTML and collapse whitespace without changing its meaning."""

    if not value:
        return ""
    return " ".join(html.unescape(str(value)).split()).casefold()


def _without_accents(value: str) -> str:
    return "".join(
        character
        for character in unicodedata.normalize("NFKD", value)
        if not unicodedata.combining(character)
    )


class RuleBasedClassifier:
    """Classify concrete news incidents into backend-compatible enum values.

    ``allowed_types`` is supplied by configuration.  Unknown values are
    rejected immediately so a typo cannot leak an incompatible payload into
    the pipeline.
    """

    def __init__(self, allowed_types: tuple[str, ...]):
        if isinstance(allowed_types, (str, bytes)) or not isinstance(allowed_types, Iterable):
            raise TypeError("allowed_types must be an iterable of incident type strings")

        normalized = tuple(dict.fromkeys(str(value).strip() for value in allowed_types))
        unknown = tuple(value for value in normalized if value not in SUPPORTED_INCIDENT_TYPES)
        if unknown:
            values = ", ".join(unknown)
            raise ValueError(f"Unsupported incident type(s): {values}")
        self.allowed_types = normalized

    def might_be_incident(self, title: str, description: str | None = None) -> bool:
        """Return whether list-page metadata describes a plausible incident.

        This is a conservative pre-filter: a crime word alone is insufficient.
        It must be accompanied by an action, victim/case cue, time, or explicit
        Bogotá location.  Aggregated and educational headlines are rejected.
        """

        if self._is_concrete_candidate(title, description, ""):
            return True

        # Listing cards frequently say only "presuntos ladrones capturados";
        # the backend-compatible type (hurto/robo/atraco) appears in the full
        # article. Allow fetching that bounded subset without classifying it
        # prematurely inside a source adapter.
        metadata = " ".join(value for value in (_clean(title), _clean(description)) if value)
        normalized_title = _without_accents(_clean(title))
        if _NON_INCIDENT_RE.search(normalized_title):
            return False
        normalized_metadata = _without_accents(metadata)
        has_category = self._category_in(normalized_metadata) is not None
        has_specific_place = bool(
            _SPECIFIC_CONTEXT_RE.search(normalized_metadata)
            or _BOGOTA_LOCALITIES_RE.search(normalized_metadata)
        )
        return bool(
            _DISCOVERY_CRIME_RE.search(metadata)
            and self._has_event_evidence(metadata)
            or has_category
            and has_specific_place
        )

    def classify(self, title: str, description: str, content: str) -> str | None:
        """Return one allowed backend enum, or ``None`` for an invalid article."""

        if not self._is_concrete_candidate(title, description, content):
            return None

        fields = (_clean(title), _clean(description), _clean(content))
        for field in fields:
            category = self._category_in(_without_accents(field))
            if category is not None:
                return category
        return None

    def classify_evidence(self, text: str) -> str | None:
        """Classify one compact event-evidence fragment.

        Unlike :meth:`classify`, this method never borrows a category or an
        action from another article field. The pipeline uses it after temporal
        extraction so the emitted type and timestamp describe the same event.
        """

        clean_value = _clean(text)
        normalized = _without_accents(clean_value)
        if not clean_value or _NON_INCIDENT_RE.search(normalized):
            return None
        category = self._category_in(normalized)
        if category is None or not self.supports_evidence_type(text, category):
            return None
        return category

    def supports_evidence_type(self, text: str, incident_type: str) -> bool:
        """Return whether one exact fragment supports a specific allowed type.

        A sentence may explicitly contain more than one backend category (for
        example, ``atracos`` and ``robo``). Verification must evaluate the
        model's proposed type itself instead of rejecting it merely because a
        different valid category appears earlier in the sentence.
        """

        if incident_type not in self.allowed_types:
            return False
        clean_value = _clean(text)
        normalized = _without_accents(clean_value)
        if (
            not clean_value
            or _NON_INCIDENT_RE.search(normalized)
            or not any(
                pattern.search(normalized)
                for pattern in _CATEGORY_PATTERNS[incident_type]
            )
            or not self._has_event_evidence(clean_value)
        ):
            return False
        direct_property_event = _DIRECT_PROPERTY_INCIDENT_RE.get(incident_type)
        has_direct_property_event = bool(
            direct_property_event is not None
            and (
                direct_property_event.search(normalized)
                or _ACCENTED_PROPERTY_ACTION_RE[incident_type].search(clean_value)
            )
        )
        if (
            direct_property_event is not None
            and _PROPERTY_STATUS_RE.search(normalized)
            and not has_direct_property_event
        ):
            return False
        if (
            direct_property_event is not None
            and _PRESUMED_INVOLVEMENT_RE.search(normalized)
            and not has_direct_property_event
        ):
            return False
        if (
            direct_property_event is not None
            and _ARREST_ACTION_RE.search(normalized)
            and not has_direct_property_event
            and _EXPLICIT_OCCURRENCE_RE.search(normalized) is None
        ):
            return False
        return True

    def _is_concrete_candidate(
        self,
        title: str | None,
        description: str | None,
        content: str | None,
    ) -> bool:
        clean_title = _clean(title)
        clean_description = _clean(description)
        clean_content = _clean(content)
        normalized_title = _without_accents(clean_title)
        normalized_description = _without_accents(clean_description)

        if not clean_title or _NON_INCIDENT_RE.search(normalized_title):
            return False

        title_category = self._category_in(normalized_title)
        if title_category is not None and self._has_event_evidence(clean_title):
            return True

        # An exclusion in the summary is relevant when the title itself did not
        # already establish a concrete incident.  We deliberately do not scan
        # the full body for these words: a real report may end with prevention
        # advice or contextual statistics.
        if normalized_description and _NON_INCIDENT_RE.search(normalized_description):
            return False

        combined = " ".join(
            value for value in (clean_title, clean_description, clean_content) if value
        )
        normalized_combined = _without_accents(combined)
        if self._category_in(normalized_combined) is None:
            return False
        return self._has_event_evidence(combined)

    def _category_in(self, normalized_text: str) -> str | None:
        matches: list[tuple[int, int, str]] = []
        for category in self.allowed_types:
            for pattern in _CATEGORY_PATTERNS[category]:
                match = pattern.search(normalized_text)
                if match:
                    matches.append((match.start(), _CATEGORY_PRIORITY[category], category))
                    break
        if not matches:
            return None
        return min(matches)[2]

    @staticmethod
    def _has_event_evidence(clean_text: str) -> bool:
        normalized = _without_accents(clean_text)
        if _EVENT_ACTION_RE.search(normalized) or _ACCENTED_ACTION_RE.search(clean_text):
            return True

        has_subject = bool(_SUBJECT_OR_CASE_RE.search(normalized))
        has_context = bool(
            _SPECIFIC_CONTEXT_RE.search(normalized)
            or _BOGOTA_LOCALITIES_RE.search(normalized)
        )
        return has_subject and has_context


__all__ = ["RuleBasedClassifier", "SUPPORTED_INCIDENT_TYPES"]
