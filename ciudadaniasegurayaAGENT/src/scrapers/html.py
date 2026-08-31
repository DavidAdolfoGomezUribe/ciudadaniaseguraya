import json
import logging
import re
from collections.abc import Iterable
from datetime import datetime
from email.utils import parsedate_to_datetime
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup, Tag

from src.config.constants import BOGOTA_TIMEZONE
from src.scrapers.normalization import clean_text

logger = logging.getLogger(__name__)

PROMOTIONAL_PREFIXES = (
    "además:",
    "también puedes leer",
    "también puede leer",
    "te puede interesar",
    "le puede interesar",
    "lea también",
    "no se vaya sin leer",
    "puede leer",
    "puedes leer",
    "conozca también",
)


def json_ld_nodes(soup: BeautifulSoup) -> list[dict[str, object]]:
    nodes: list[dict[str, object]] = []
    for script in soup.select('script[type="application/ld+json"]'):
        try:
            payload = json.loads(script.string or script.get_text())
        except (TypeError, json.JSONDecodeError):
            logger.debug("Ignoring malformed JSON-LD block")
            continue
        candidates = payload if isinstance(payload, list) else [payload]
        for candidate in candidates:
            if not isinstance(candidate, dict):
                continue
            graph = candidate.get("@graph")
            if isinstance(graph, list):
                nodes.extend(item for item in graph if isinstance(item, dict))
            else:
                nodes.append(candidate)
    return nodes


def json_ld_node(soup: BeautifulSoup, schema_type: str) -> dict[str, object] | None:
    for node in json_ld_nodes(soup):
        node_type = node.get("@type")
        types = node_type if isinstance(node_type, list) else [node_type]
        if schema_type in types:
            return node
    return None


def parse_datetime(value: str | None, *, assume_bogota: bool = False) -> datetime | None:
    if not value:
        return None
    candidate = clean_text(value).replace("·", "-")
    try:
        parsed = datetime.fromisoformat(candidate.replace("Z", "+00:00"))
    except ValueError:
        try:
            parsed = parsedate_to_datetime(candidate)
        except (TypeError, ValueError, OverflowError):
            parsed = _parse_spanish_display_date(candidate)
    if parsed is None:
        return None
    if parsed.utcoffset() is None:
        if not assume_bogota:
            return None
        parsed = parsed.replace(tzinfo=ZoneInfo(BOGOTA_TIMEZONE))
    return parsed


def _parse_spanish_display_date(value: str) -> datetime | None:
    months = {
        "ene": 1,
        "feb": 2,
        "mar": 3,
        "abr": 4,
        "may": 5,
        "jun": 6,
        "jul": 7,
        "ago": 8,
        "sep": 9,
        "oct": 10,
        "nov": 11,
        "dic": 12,
    }
    match = re.search(r"\b(\d{1,2})[-\s]([a-záéíóú]{3})[-\s](\d{4})\b", value.casefold())
    if not match or match.group(2)[:3] not in months:
        return None
    try:
        return datetime(
            int(match.group(3)),
            months[match.group(2)[:3]],
            int(match.group(1)),
            tzinfo=ZoneInfo(BOGOTA_TIMEZONE),
        )
    except ValueError:
        return None


def text_from_html(fragment: str | None) -> str:
    if not fragment:
        return ""
    soup = BeautifulSoup(fragment, "lxml")
    return clean_text(soup.get_text(" ", strip=True))


def article_text(root: Tag) -> str:
    """Extract ordered article blocks while removing embedded/related material."""

    for element in root.select(
        "script, style, noscript, iframe, form, nav, .wp-block-spacer, "
        ".sharedaddy, .addtoany_share_save_container"
    ):
        element.decompose()

    blocks: list[str] = []
    for element in root.select("p, h2, h3, li, blockquote"):
        if any(
            isinstance(parent, Tag) and parent.name in {"p", "li", "blockquote"}
            for parent in element.parents
            if parent is not root
        ):
            continue
        value = clean_text(element.get_text(" ", strip=True))
        lowered = value.casefold()
        if not value or lowered.startswith(PROMOTIONAL_PREFIXES):
            continue
        if lowered.startswith("the post ") and " appeared first on " in lowered:
            continue
        blocks.append(value)
    return "\n".join(dict.fromkeys(blocks))


def first_text(values: Iterable[str | None]) -> str:
    for value in values:
        normalized = clean_text(value)
        if normalized:
            return normalized
    return ""
