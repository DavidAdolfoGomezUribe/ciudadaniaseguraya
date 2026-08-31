import asyncio
import json
import logging
import math
import re
import sqlite3
import time
import unicodedata
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import httpx

from src.config.constants import BOGOTA_BOUNDS
from src.extraction.locations import LocationExtraction
from src.geolocation.base import GeocodeResult, Geocoder, GeocodingError
from src.geolocation.boundary import point_inside_bogota
from src.scrapers.normalization import clean_text

logger = logging.getLogger(__name__)

_ROUTE_NAME = (
    r"(?:avenida\s+(?:calle|carrera)|avenida|av\.?|autopista|calle|cl\.?|"
    r"carrera|cra\.?|cr\.?|diagonal|diag\.?|transversal|tv\.?)"
)
_ROUTE_NUMBER = r"(?:\d{1,3}[A-Za-z]?(?:\s+bis)?(?:\s+(?:sur|este))?)"
_INTERSECTION_PARTS_RE = re.compile(
    rf"^\s*({_ROUTE_NAME}\s+{_ROUTE_NUMBER})\s+(?:con|y|&)\s+"
    rf"({_ROUTE_NAME}\s+{_ROUTE_NUMBER})\s*$",
    re.IGNORECASE,
)
_MAX_INTERSECTION_CORROBORATION_METERS = 1_000.0


class NominatimGeocoder(Geocoder):
    """Small-volume Nominatim client with persistent caching and Bogotá checks."""

    def __init__(
        self,
        *,
        base_url: str,
        user_agent: str,
        timeout: float,
        request_delay: float,
        cache_path: Path,
        cache_ttl_days: int = 30,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.request_delay = max(request_delay, 1.0)
        self.cache_path = cache_path
        self.cache_ttl = timedelta(days=cache_ttl_days)
        self._lock = asyncio.Lock()
        self._last_request = 0.0
        self._client = httpx.AsyncClient(
            headers={
                "User-Agent": user_agent,
                "Accept": "application/json",
                "Accept-Language": "es-CO,es;q=0.9",
            },
            timeout=httpx.Timeout(timeout),
            follow_redirects=False,
            transport=transport,
        )
        self._prepare_cache()

    def _prepare_cache(self) -> None:
        self.cache_path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.cache_path) as database:
            database.execute(
                """
                CREATE TABLE IF NOT EXISTS geocoding_cache (
                    query TEXT PRIMARY KEY,
                    payload TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
                """
            )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def geocode(self, location: LocationExtraction) -> GeocodeResult | None:
        queries = self._queries(location)
        for query in queries:
            candidates = await self._search(query)
            selected = self._select_candidate(candidates, location)
            if selected is not None:
                return GeocodeResult(
                    latitude=float(selected["lat"]),
                    longitude=float(selected["lon"]),
                    display_name=clean_text(str(selected.get("display_name", ""))),
                    matched_query=query,
                )
        intersection = _intersection_routes(location.address)
        if intersection is not None:
            return await self._geocode_intersection(location, intersection)
        return None

    async def _geocode_intersection(
        self,
        location: LocationExtraction,
        routes: tuple[str, str],
    ) -> GeocodeResult | None:
        """Resolve an explicit intersection through two corroborated OSM roads.

        Nominatim often parses ``Carrera 46 & Calle 138`` as only one of the
        two roads. Accept that approximate point only when a separate bounded
        query finds the other named road within one kilometre. This preserves
        both source-stated route identifiers and avoids falling back to a broad
        locality centre.
        """

        locality = clean_text(location.locality or "")
        combined_query = _join_query_parts(
            f"{routes[0]} & {routes[1]}",
            locality,
            "Bogotá",
            "Colombia",
        )
        combined = await self._search(combined_query)
        route_candidates: dict[str, list[dict[str, Any]]] = {}

        for candidate in combined:
            point = _coherent_bogota_point(candidate, locality)
            if point is None:
                continue
            candidate_text = _candidate_location_text(
                candidate,
                candidate.get("address")
                if isinstance(candidate.get("address"), dict)
                else {},
            )
            matched = {
                route for route in routes if _matches_route(route, candidate_text)
            }
            if not matched:
                continue

            corroborated = True
            for route in routes:
                if route in matched:
                    continue
                if route not in route_candidates:
                    route_query = _join_query_parts(
                        route,
                        locality,
                        "Bogotá",
                        "Colombia",
                    )
                    route_candidates[route] = await self._search(route_query)
                nearby = _has_nearby_route_candidate(
                    route_candidates[route],
                    route,
                    point,
                    locality,
                )
                if not nearby and locality:
                    # Nominatim can rank a different segment first when a
                    # district is included. Retry the same named road without
                    # the district while retaining the bounded Bogotá search
                    # and validating the returned candidate against it.
                    broad_route_query = _join_query_parts(
                        route,
                        "Bogotá",
                        "Colombia",
                    )
                    broad_candidates = await self._search(broad_route_query)
                    route_candidates[route].extend(broad_candidates)
                    nearby = _has_nearby_route_candidate(
                        broad_candidates,
                        route,
                        point,
                        locality,
                    )
                if not nearby:
                    corroborated = False
                    break

            if corroborated:
                return GeocodeResult(
                    latitude=point[0],
                    longitude=point[1],
                    display_name=clean_text(str(candidate.get("display_name", ""))),
                    matched_query=combined_query,
                )
        return None

    @staticmethod
    def _queries(location: LocationExtraction) -> tuple[str, ...]:
        # Nominatim indexes the proper place names (for example ``Restrepo``),
        # not the journalistic labels ``barrio Restrepo`` or ``localidad de
        # Antonio Nariño``. Keep those labels in the payload evidence, but do
        # not send them as part of the search name.
        neighborhood = clean_text(location.neighborhood or "")
        locality = clean_text(location.locality or "")
        address = clean_text(location.address)
        search_address = _searchable_address(address)
        explicit_address = not _is_neighborhood_only(address, neighborhood)

        queries: list[str] = []
        if explicit_address:
            queries.append(
                _join_query_parts(
                    search_address,
                    neighborhood,
                    locality,
                    "Bogotá",
                    "Colombia",
                )
            )
        if neighborhood:
            queries.append(
                _join_query_parts(neighborhood, locality, "Bogotá", "Colombia")
            )
        if locality and neighborhood:
            queries.append(_join_query_parts(neighborhood, "Bogotá", "Colombia"))

        unique: dict[str, str] = {}
        for query in queries:
            unique.setdefault(_normalize(query), query)
        return tuple(unique.values())

    async def _search(self, query: str) -> list[dict[str, Any]]:
        key = _normalize(query)
        cached = self._cache_get(key)
        if cached is not None:
            logger.info('Geocoding cache hit: "%s"', query)
            return cached

        async with self._lock:
            cached = self._cache_get(key)
            if cached is not None:
                return cached
            elapsed = time.monotonic() - self._last_request
            if elapsed < self.request_delay:
                await asyncio.sleep(self.request_delay - elapsed)
            logger.info('Geocoding with Nominatim: "%s"', query)
            try:
                response = await self._client.get(
                    f"{self.base_url}/search",
                    params={
                        "q": query,
                        "format": "jsonv2",
                        "addressdetails": "1",
                        "limit": "5",
                        "countrycodes": "co",
                        "viewbox": (
                            f'{BOGOTA_BOUNDS["west"]},{BOGOTA_BOUNDS["north"]},'
                            f'{BOGOTA_BOUNDS["east"]},{BOGOTA_BOUNDS["south"]}'
                        ),
                        "bounded": "1",
                        "accept-language": "es",
                    },
                )
            except (httpx.TimeoutException, httpx.NetworkError) as exc:
                raise GeocodingError(f"Nominatim request failed: {exc}") from exc
            finally:
                self._last_request = time.monotonic()

            if response.status_code != 200:
                raise GeocodingError(
                    f"Nominatim returned HTTP {response.status_code}"
                )
            try:
                payload = response.json()
            except json.JSONDecodeError as exc:
                raise GeocodingError("Nominatim returned invalid JSON") from exc
            if not isinstance(payload, list):
                raise GeocodingError("Nominatim returned an unexpected payload")
            candidates = [item for item in payload if isinstance(item, dict)]
            self._cache_put(key, candidates)
            return candidates

    def _select_candidate(
        self,
        candidates: list[dict[str, Any]],
        location: LocationExtraction,
    ) -> dict[str, Any] | None:
        scored: list[tuple[int, dict[str, Any]]] = []
        neighborhood = _normalize(location.neighborhood or "")
        locality = _normalize(location.locality or "")

        for candidate in candidates:
            try:
                latitude = float(candidate["lat"])
                longitude = float(candidate["lon"])
            except (KeyError, TypeError, ValueError):
                continue
            if not _inside_bogota(latitude, longitude):
                continue

            address = candidate.get("address")
            address = address if isinstance(address, dict) else {}
            country_code = _normalize(str(address.get("country_code", "")))
            display = _normalize(str(candidate.get("display_name", "")))
            candidate_text = _candidate_location_text(candidate, address)
            administrative = _normalize(
                " ".join(
                    str(address.get(key, ""))
                    for key in (
                        "city",
                        "municipality",
                        "state",
                        "state_district",
                        "city_district",
                    )
                )
            )
            if country_code and country_code != "co":
                continue
            if not _contains_normalized_phrase(
                f"{display} {administrative}", "bogota"
            ):
                continue

            score = 1
            neighborhood_match = _matches_named_component(
                candidate,
                address,
                neighborhood,
                prefixes=("barrio", "barrio de"),
                address_keys=(
                    "neighbourhood",
                    "neighborhood",
                    "suburb",
                    "quarter",
                    "residential",
                ),
            )
            explicit_address_match = _matches_explicit_address(
                location.address,
                location.neighborhood,
                candidate_text,
            )
            locality_match = bool(locality) and _matches_named_component(
                candidate,
                address,
                locality,
                prefixes=("localidad", "localidad de"),
                address_keys=("city_district", "state_district", "municipality"),
            )

            # A locality is too broad to prove that Nominatim resolved the
            # explicit neighborhood/address stated by the article. Require a
            # useful match against at least one of those finer-grained facts.
            if not (neighborhood_match or explicit_address_match):
                continue
            # When Nominatim returns a district/locality, it must not
            # contradict the locality stated by the article. Some precise
            # street results omit district fields entirely; those may still
            # be accepted through their strong address match.
            candidate_has_locality = any(
                clean_text(str(address.get(key, "")))
                for key in ("city_district", "state_district")
            )
            municipality = _normalize(str(address.get("municipality", "")))
            candidate_has_locality = candidate_has_locality or bool(
                municipality and municipality != "bogota"
            )
            if locality and candidate_has_locality and not locality_match:
                continue

            if neighborhood_match:
                score += 8
            if explicit_address_match:
                score += 7
            if locality_match:
                score += 4
            importance = candidate.get("importance")
            if isinstance(importance, (float, int)):
                score += round(float(importance) * 2)
            scored.append((score, candidate))

        if not scored:
            return None
        scored.sort(key=lambda item: item[0], reverse=True)
        return scored[0][1]

    def _cache_get(self, key: str) -> list[dict[str, Any]] | None:
        with sqlite3.connect(self.cache_path) as database:
            row = database.execute(
                "SELECT payload, created_at FROM geocoding_cache WHERE query = ?", (key,)
            ).fetchone()
        if row is None:
            return None
        try:
            created_at = datetime.fromisoformat(row[1])
            if datetime.now(UTC) - created_at > self.cache_ttl:
                return None
            payload = json.loads(row[0])
        except (TypeError, ValueError, json.JSONDecodeError):
            return None
        return payload if isinstance(payload, list) else None

    def _cache_put(self, key: str, payload: list[dict[str, Any]]) -> None:
        with sqlite3.connect(self.cache_path) as database:
            database.execute(
                """
                INSERT INTO geocoding_cache(query, payload, created_at)
                VALUES (?, ?, ?)
                ON CONFLICT(query) DO UPDATE SET
                    payload = excluded.payload,
                    created_at = excluded.created_at
                """,
                (key, json.dumps(payload, ensure_ascii=False), datetime.now(UTC).isoformat()),
            )


def _normalize(value: str) -> str:
    decomposed = unicodedata.normalize("NFKD", clean_text(value).casefold())
    unaccented = "".join(char for char in decomposed if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", unaccented).strip()


def _join_query_parts(*parts: str) -> str:
    unique: dict[str, str] = {}
    for part in parts:
        cleaned = clean_text(part)
        normalized = _normalize(cleaned)
        if cleaned and normalized not in unique:
            unique[normalized] = cleaned
    return ", ".join(unique.values())


def _intersection_routes(address: str) -> tuple[str, str] | None:
    match = _INTERSECTION_PARTS_RE.fullmatch(clean_text(address))
    if match is None:
        return None
    return clean_text(match.group(1)), clean_text(match.group(2))


def _matches_route(route: str, candidate_text: str) -> bool:
    route_tokens = set(_normalize(route).split())
    candidate_tokens = set(_normalize(candidate_text).split())
    return bool(route_tokens) and route_tokens.issubset(candidate_tokens)


def _coherent_bogota_point(
    candidate: dict[str, Any],
    locality: str,
) -> tuple[float, float] | None:
    try:
        latitude = float(candidate["lat"])
        longitude = float(candidate["lon"])
    except (KeyError, TypeError, ValueError):
        return None
    if not _inside_bogota(latitude, longitude):
        return None

    address = candidate.get("address")
    address = address if isinstance(address, dict) else {}
    country_code = _normalize(str(address.get("country_code", "")))
    if country_code and country_code != "co":
        return None
    candidate_text = _candidate_location_text(candidate, address)
    if not _contains_normalized_phrase(candidate_text, "bogota"):
        return None

    normalized_locality = _normalize(locality)
    if normalized_locality:
        candidate_has_locality = any(
            clean_text(str(address.get(key, "")))
            for key in ("city_district", "state_district")
        )
        municipality = _normalize(str(address.get("municipality", "")))
        candidate_has_locality = candidate_has_locality or bool(
            municipality and municipality != "bogota"
        )
        locality_match = _matches_named_component(
            candidate,
            address,
            normalized_locality,
            prefixes=("localidad", "localidad de"),
            address_keys=("city_district", "state_district", "municipality"),
        )
        if candidate_has_locality and not locality_match:
            return None
    return latitude, longitude


def _has_nearby_route_candidate(
    candidates: list[dict[str, Any]],
    route: str,
    point: tuple[float, float],
    locality: str,
) -> bool:
    for candidate in candidates:
        candidate_point = _coherent_bogota_point(candidate, locality)
        if candidate_point is None:
            continue
        candidate_text = _candidate_location_text(
            candidate,
            candidate.get("address")
            if isinstance(candidate.get("address"), dict)
            else {},
        )
        if not _matches_route(route, candidate_text):
            continue
        if (
            _distance_meters(point, candidate_point)
            <= _MAX_INTERSECTION_CORROBORATION_METERS
        ):
            return True
    return False


def _distance_meters(
    first: tuple[float, float],
    second: tuple[float, float],
) -> float:
    latitude_1, longitude_1 = (math.radians(value) for value in first)
    latitude_2, longitude_2 = (math.radians(value) for value in second)
    delta_latitude = latitude_2 - latitude_1
    delta_longitude = longitude_2 - longitude_1
    haversine = (
        math.sin(delta_latitude / 2) ** 2
        + math.cos(latitude_1)
        * math.cos(latitude_2)
        * math.sin(delta_longitude / 2) ** 2
    )
    return 6_371_000 * 2 * math.asin(min(1.0, math.sqrt(haversine)))


def _is_neighborhood_only(address: str, neighborhood: str) -> bool:
    normalized_address = _normalize(address)
    normalized_neighborhood = _normalize(neighborhood)
    if not normalized_neighborhood:
        return False
    return normalized_address in {
        normalized_neighborhood,
        f"barrio {normalized_neighborhood}",
        f"barrio de {normalized_neighborhood}",
    }


def _location_terms(value: str) -> tuple[str, ...]:
    ignored = {
        "bogota",
        "barrio",
        "localidad",
        "sector",
        "avenida",
        "calle",
        "carrera",
        "diagonal",
        "transversal",
        "numero",
        "con",
        "entre",
        "sur",
        "norte",
    }
    tokens = [token for token in _normalize(value).split() if token not in ignored]
    return tuple(dict.fromkeys(token for token in tokens if len(token) >= 2))


def _searchable_address(value: str) -> str:
    cleaned = clean_text(value)
    cleaned = re.sub(
        r"^(?:sector|zona)(?:\s+de)?\s+",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    return re.sub(
        r"\s+en\s+Bogot[aá]\s*$",
        "",
        cleaned,
        flags=re.IGNORECASE,
    ).strip()


def _candidate_location_text(
    candidate: dict[str, Any],
    address: dict[str, Any],
) -> str:
    values = [str(candidate.get("display_name", ""))]
    values.extend(str(value) for value in address.values() if isinstance(value, str))
    return _normalize(" ".join(values))


def _contains_normalized_phrase(haystack: str, needle: str) -> bool:
    normalized_haystack = _normalize(haystack)
    normalized_needle = _normalize(needle)
    if not normalized_haystack or not normalized_needle:
        return False
    return f" {normalized_needle} " in f" {normalized_haystack} "


def _matches_named_component(
    candidate: dict[str, Any],
    address: dict[str, Any],
    normalized_name: str,
    *,
    prefixes: tuple[str, ...],
    address_keys: tuple[str, ...],
) -> bool:
    if not normalized_name:
        return False

    accepted = {normalized_name}
    accepted.update(f"{prefix_} {normalized_name}" for prefix_ in prefixes)
    display_parts = str(candidate.get("display_name", "")).split(",")
    structured_parts = [str(address.get(key, "")) for key in address_keys]
    return any(
        _normalize(part) in accepted
        for part in (*display_parts, *structured_parts)
        if clean_text(part)
    )


def _matches_explicit_address(
    address: str,
    neighborhood: str | None,
    candidate_text: str,
) -> bool:
    normalized_address = _normalize(address)
    normalized_neighborhood = _normalize(neighborhood or "")
    if normalized_neighborhood:
        neighborhood_aliases = {
            normalized_neighborhood,
            f"barrio {normalized_neighborhood}",
            f"barrio de {normalized_neighborhood}",
        }
        if normalized_address in neighborhood_aliases:
            return False

    terms = _location_terms(_searchable_address(address))
    if len(terms) < 2:
        return False
    candidate_tokens = set(_normalize(candidate_text).split())
    matched_terms = sum(1 for term in terms if term in candidate_tokens)
    required_terms = max(2, (2 * len(terms) + 2) // 3)
    return matched_terms >= required_terms


def _inside_bogota(latitude: float, longitude: float) -> bool:
    inside_bounds = (
        BOGOTA_BOUNDS["south"] <= latitude <= BOGOTA_BOUNDS["north"]
        and BOGOTA_BOUNDS["west"] <= longitude <= BOGOTA_BOUNDS["east"]
    )
    return inside_bounds and point_inside_bogota(latitude, longitude)
