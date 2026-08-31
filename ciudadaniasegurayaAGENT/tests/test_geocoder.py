import httpx
import pytest

from src.extraction.locations import LocationExtraction
from src.geolocation.nominatim import NominatimGeocoder


def test_queries_use_nominatim_place_names_without_journalistic_markers(
    tmp_path,
) -> None:
    location = LocationExtraction(
        address="barrio Restrepo",
        neighborhood="Restrepo",
        locality="Antonio Nariño",
        evidence="barrio Restrepo; localidad de Antonio Nariño",
    )

    queries = NominatimGeocoder._queries(location)

    assert queries == (
        "Restrepo, Antonio Nariño, Bogotá, Colombia",
        "Restrepo, Bogotá, Colombia",
    )
    assert all("barrio" not in query.casefold() for query in queries)
    assert all("localidad de" not in query.casefold() for query in queries)


def test_queries_keep_an_explicit_street_before_the_place_names(tmp_path) -> None:
    location = LocationExtraction(
        address="Carrera 20 con Calle 15",
        neighborhood="Restrepo",
        locality="Antonio Nariño",
        evidence="barrio Restrepo; Carrera 20 con Calle 15",
    )

    queries = NominatimGeocoder._queries(location)

    assert queries[0] == (
        "Carrera 20 con Calle 15, Restrepo, Antonio Nariño, Bogotá, Colombia"
    )
    assert queries[1:] == (
        "Restrepo, Antonio Nariño, Bogotá, Colombia",
        "Restrepo, Bogotá, Colombia",
    )


def test_queries_support_explicit_address_without_neighborhood() -> None:
    location = LocationExtraction(
        address="Carrera 16 con Calle 23",
        neighborhood=None,
        locality="Los Mártires",
        evidence="Carrera 16 con Calle 23; localidad de Los Mártires",
    )

    assert NominatimGeocoder._queries(location) == (
        "Carrera 16 con Calle 23, Los Mártires, Bogotá, Colombia",
    )


def test_queries_remove_journalistic_named_area_marker() -> None:
    location = LocationExtraction(
        address="sector de Lagos de Torca",
        neighborhood=None,
        locality="Suba",
        evidence="sector de Lagos de Torca; localidad de Suba",
    )

    assert NominatimGeocoder._queries(location) == (
        "Lagos de Torca, Suba, Bogotá, Colombia",
    )


def test_queries_remove_redundant_bogota_suffix_from_landmark() -> None:
    location = LocationExtraction(
        address="cárcel La Modelo en Bogotá",
        neighborhood=None,
        locality=None,
        evidence="cárcel La Modelo en Bogotá",
    )

    assert NominatimGeocoder._queries(location) == (
        "cárcel La Modelo, Bogotá, Colombia",
    )


@pytest.mark.asyncio
async def test_geocoder_caches_and_selects_coherent_bogota_result(tmp_path) -> None:
    calls = 0

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(
            200,
            json=[
                {
                    "lat": "4.5858",
                    "lon": "-74.1012",
                    "display_name": "Restrepo, Antonio Nariño, Bogotá, Colombia",
                    "importance": 0.6,
                    "address": {
                        "suburb": "Restrepo",
                        "city": "Bogotá",
                        "country_code": "co",
                    },
                }
            ],
        )

    geocoder = NominatimGeocoder(
        base_url="https://nominatim.test",
        user_agent="CiudadaniaSeguraYaAgent/Test (+https://example.test)",
        timeout=2,
        request_delay=1,
        cache_path=tmp_path / "cache.sqlite3",
        transport=httpx.MockTransport(handler),
    )
    location = LocationExtraction(
        address="Carrera 20 con Calle 15",
        neighborhood="Restrepo",
        locality="Antonio Nariño",
        evidence="barrio Restrepo; Carrera 20 con Calle 15",
    )

    first = await geocoder.geocode(location)
    second = await geocoder.geocode(location)
    await geocoder.aclose()

    assert first is not None
    assert second == first
    assert calls == 1
    assert first.latitude == pytest.approx(4.5858)


@pytest.mark.asyncio
async def test_geocoder_rejects_result_outside_bogota(tmp_path) -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json=[
                {
                    "lat": "6.2442",
                    "lon": "-75.5812",
                    "display_name": "Restrepo, Medellín, Colombia",
                    "address": {"city": "Medellín", "country_code": "co"},
                }
            ],
        )

    geocoder = NominatimGeocoder(
        base_url="https://nominatim.test",
        user_agent="CiudadaniaSeguraYaAgent/Test (+https://example.test)",
        timeout=2,
        request_delay=1,
        cache_path=tmp_path / "cache.sqlite3",
        transport=httpx.MockTransport(handler),
    )
    result = await geocoder.geocode(
        LocationExtraction(
            address="barrio Restrepo",
            neighborhood="Restrepo",
            locality=None,
            evidence="barrio Restrepo",
        )
    )
    await geocoder.aclose()

    assert result is None


@pytest.mark.asyncio
async def test_geocoder_rejects_locality_only_match_for_explicit_location(
    tmp_path,
) -> None:
    geocoder = NominatimGeocoder(
        base_url="https://nominatim.test",
        user_agent="CiudadaniaSeguraYaAgent/Test (+https://example.test)",
        timeout=2,
        request_delay=1,
        cache_path=tmp_path / "cache.sqlite3",
        transport=httpx.MockTransport(lambda request: httpx.Response(200, json=[])),
    )
    candidate = {
        "lat": "4.5858",
        "lon": "-74.1012",
        "display_name": "Antonio Nariño, Bogotá, Colombia",
        "address": {
            "city_district": "Antonio Nariño",
            "city": "Bogotá",
            "country_code": "co",
        },
    }
    location = LocationExtraction(
        address="Carrera 20 con Calle 15",
        neighborhood="Restrepo",
        locality="Antonio Nariño",
        evidence="barrio Restrepo; Carrera 20 con Calle 15",
    )

    selected = geocoder._select_candidate([candidate], location)
    await geocoder.aclose()

    assert selected is None


@pytest.mark.asyncio
async def test_geocoder_rejects_neighborhood_in_a_different_stated_locality(
    tmp_path,
) -> None:
    geocoder = NominatimGeocoder(
        base_url="https://nominatim.test",
        user_agent="CiudadaniaSeguraYaAgent/Test (+https://example.test)",
        timeout=2,
        request_delay=1,
        cache_path=tmp_path / "cache.sqlite3",
        transport=httpx.MockTransport(lambda request: httpx.Response(200, json=[])),
    )
    candidate = {
        "lat": "4.6939",
        "lon": "-74.1001",
        "display_name": "Tabora, Engativá, Bogotá, Colombia",
        "address": {
            "suburb": "Tabora",
            "city_district": "Engativá",
            "city": "Bogotá",
            "country_code": "co",
        },
    }
    location = LocationExtraction(
        address="barrio Tabora",
        neighborhood="Tabora",
        locality="Teusaquillo",
        evidence="barrio Tabora; localidad de Teusaquillo",
    )

    selected = geocoder._select_candidate([candidate], location)
    await geocoder.aclose()

    assert selected is None


@pytest.mark.asyncio
async def test_geocoder_accepts_strong_address_match_without_neighborhood_label(
    tmp_path,
) -> None:
    geocoder = NominatimGeocoder(
        base_url="https://nominatim.test",
        user_agent="CiudadaniaSeguraYaAgent/Test (+https://example.test)",
        timeout=2,
        request_delay=1,
        cache_path=tmp_path / "cache.sqlite3",
        transport=httpx.MockTransport(lambda request: httpx.Response(200, json=[])),
    )
    candidate = {
        "lat": "4.5858",
        "lon": "-74.1012",
        "display_name": "Carrera 20 con Calle 15, Bogotá, Colombia",
        "address": {
            "road": "Carrera 20 con Calle 15",
            "city": "Bogotá",
            "country_code": "co",
        },
    }
    location = LocationExtraction(
        address="Carrera 20 con Calle 15",
        neighborhood="Restrepo",
        locality="Antonio Nariño",
        evidence="barrio Restrepo; Carrera 20 con Calle 15",
    )

    selected = geocoder._select_candidate([candidate], location)
    await geocoder.aclose()

    assert selected == candidate


@pytest.mark.asyncio
async def test_geocoder_resolves_intersection_with_two_nearby_osm_roads(
    tmp_path,
) -> None:
    queries: list[str] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        query = request.url.params["q"]
        queries.append(query)
        if " con " in query:
            return httpx.Response(200, json=[])
        if " & " in query:
            return httpx.Response(
                200,
                json=[
                    {
                        "lat": "4.7238194",
                        "lon": "-74.0523608",
                        "display_name": "Calle 138, Localidad Suba, Bogotá, Colombia",
                        "address": {
                            "road": "Calle 138",
                            "city_district": "Localidad Suba",
                            "city": "Bogotá",
                            "country_code": "co",
                        },
                    }
                ],
            )
        if query.startswith("Carrera 46,"):
            return httpx.Response(
                200,
                json=[
                    {
                        "lat": "4.7173480",
                        "lon": "-74.0540641",
                        "display_name": "Carrera 46, Localidad Suba, Bogotá, Colombia",
                        "address": {
                            "road": "Carrera 46",
                            "city_district": "Localidad Suba",
                            "city": "Bogotá",
                            "country_code": "co",
                        },
                    }
                ],
            )
        return httpx.Response(200, json=[])

    geocoder = NominatimGeocoder(
        base_url="https://nominatim.test",
        user_agent="CiudadaniaSeguraYaAgent/Test (+https://example.test)",
        timeout=2,
        request_delay=1,
        cache_path=tmp_path / "cache.sqlite3",
        transport=httpx.MockTransport(handler),
    )
    result = await geocoder.geocode(
        LocationExtraction(
            address="Carrera 46 con Calle 138",
            neighborhood=None,
            locality="Suba",
            evidence="Carrera 46 con Calle 138; localidad de Suba",
        )
    )
    await geocoder.aclose()

    assert result is not None
    assert result.latitude == pytest.approx(4.7238194)
    assert result.matched_query == (
        "Carrera 46 & Calle 138, Suba, Bogotá, Colombia"
    )
    assert queries == [
        "Carrera 46 con Calle 138, Suba, Bogotá, Colombia",
        "Carrera 46 & Calle 138, Suba, Bogotá, Colombia",
        "Carrera 46, Suba, Bogotá, Colombia",
    ]


@pytest.mark.asyncio
async def test_intersection_retries_road_without_locality_when_ranking_hides_segment(
    tmp_path,
) -> None:
    queries: list[str] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        query = request.url.params["q"]
        queries.append(query)
        if " con " in query:
            return httpx.Response(200, json=[])
        if " & " in query:
            road = "Calle 138"
            latitude, longitude = "4.7242084", "-74.0537437"
        elif query == "Carrera 46, Suba, Bogotá, Colombia":
            road = "Carrera 46"
            latitude, longitude = "4.7461540", "-74.0486011"
        elif query == "Carrera 46, Bogotá, Colombia":
            road = "Carrera 46"
            latitude, longitude = "4.7243430", "-74.0522148"
        else:
            return httpx.Response(200, json=[])
        return httpx.Response(
            200,
            json=[
                {
                    "lat": latitude,
                    "lon": longitude,
                    "display_name": f"{road}, Localidad Suba, Bogotá, Colombia",
                    "address": {
                        "road": road,
                        "city_district": "Localidad Suba",
                        "city": "Bogotá",
                        "country_code": "co",
                    },
                }
            ],
        )

    geocoder = NominatimGeocoder(
        base_url="https://nominatim.test",
        user_agent="CiudadaniaSeguraYaAgent/Test (+https://example.test)",
        timeout=2,
        request_delay=1,
        cache_path=tmp_path / "cache.sqlite3",
        transport=httpx.MockTransport(handler),
    )
    result = await geocoder.geocode(
        LocationExtraction(
            address="Carrera 46 con Calle 138",
            neighborhood=None,
            locality="Suba",
            evidence="Carrera 46 con Calle 138; localidad de Suba",
        )
    )
    await geocoder.aclose()

    assert result is not None
    assert result.latitude == pytest.approx(4.7242084)
    assert queries == [
        "Carrera 46 con Calle 138, Suba, Bogotá, Colombia",
        "Carrera 46 & Calle 138, Suba, Bogotá, Colombia",
        "Carrera 46, Suba, Bogotá, Colombia",
        "Carrera 46, Bogotá, Colombia",
    ]
