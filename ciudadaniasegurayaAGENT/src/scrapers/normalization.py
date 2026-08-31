import hashlib
import html
import re
import unicodedata
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

WHITESPACE_RE = re.compile(r"\s+")
TRACKING_PARAMETERS = {
    "fbclid",
    "gclid",
    "mc_cid",
    "mc_eid",
    "ref",
}


def clean_text(value: str | None) -> str:
    if not value:
        return ""
    text = WHITESPACE_RE.sub(" ", html.unescape(value)).strip()
    # Some CMS themes render the first letter of a paragraph as a separate
    # drop-cap element. BeautifulSoup then sees "U na" or "E l". Repair only
    # these unambiguous Spanish article splits so exact-evidence checks compare
    # the visible word rather than the HTML styling artifact.
    text = re.sub(
        r"\b([Uu])\s+(na|no|nas|nos)\b",
        lambda match: match.group(1) + match.group(2),
        text,
    )
    text = re.sub(
        r"\b([Ee])\s+(l)\b",
        lambda match: match.group(1) + match.group(2),
        text,
    )
    # CMS text extraction can also leave a space before sentence punctuation
    # (``Bogotá .``). The browser renders both forms identically; normalize the
    # artifact so verbatim evidence remains stable across scraper and LLM text.
    return re.sub(r"\s+([,.;:!?])", r"\1", text)


def canonicalize_url(value: str) -> str:
    parts = urlsplit(value.strip())
    query = [
        (key, item)
        for key, item in parse_qsl(parts.query, keep_blank_values=True)
        if not key.lower().startswith("utm_") and key.lower() not in TRACKING_PARAMETERS
    ]
    path = re.sub(r"/{2,}", "/", parts.path or "/")
    return urlunsplit(
        (parts.scheme.lower(), parts.netloc.lower(), path, urlencode(sorted(query)), "")
    )


def normalized_title(value: str) -> str:
    text = clean_text(value).casefold()
    text = "".join(
        char
        for char in unicodedata.normalize("NFKD", text)
        if not unicodedata.combining(char)
    )
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def title_fingerprint(value: str) -> str:
    return hashlib.sha256(normalized_title(value).encode("utf-8")).hexdigest()


def concise_description(value: str, *, maximum: int = 600) -> str:
    text = clean_text(value)
    if maximum < 2:
        raise ValueError("maximum must be at least 2")
    if _utf16_length(text) <= maximum:
        return text

    # Leave one UTF-16 code unit for the ellipsis. This mirrors the length
    # semantics of the JavaScript/Zod backend even when source text has emoji.
    units = 0
    characters: list[str] = []
    for character in text:
        width = _utf16_length(character)
        if units + width > maximum - 1:
            break
        characters.append(character)
        units += width
    prefix = "".join(characters)
    boundary = prefix.rfind(" ")
    if boundary >= 10:
        prefix = prefix[:boundary]
    return prefix.rstrip(" ,;:") + "…"


def _utf16_length(value: str) -> int:
    return len(value.encode("utf-16-le")) // 2
