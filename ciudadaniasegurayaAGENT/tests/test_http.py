import httpx
import pytest

import src.scrapers.http as http_module
from src.scrapers.http import (
    RedirectError,
    RespectfulHttpClient,
    RobotsDeniedError,
    SourceUnavailableError,
    TooManyRedirectsError,
    UnexpectedStatusError,
    UnsafeUrlError,
)

USER_AGENT = "CiudadaniaSeguraYaAgent/Test (+https://example.test)"
ALLOW_ALL = "User-agent: *\nAllow: /\n"


def make_client(
    handler: httpx.AsyncBaseTransport | httpx.MockTransport,
    *,
    retries: int = 0,
    max_redirects: int = 5,
) -> RespectfulHttpClient:
    return RespectfulHttpClient(
        user_agent=USER_AGENT,
        timeout=2,
        request_delay=0,
        retries=retries,
        max_redirects=max_redirects,
        transport=handler,
    )


@pytest.mark.asyncio
async def test_relative_and_cross_origin_redirects_check_robots_before_each_hop() -> None:
    requests: list[str] = []
    final_headers: httpx.Headers | None = None

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal final_headers
        requests.append(str(request.url))
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text=ALLOW_ALL)
        if request.url.host == "source.test" and request.url.path == "/start":
            return httpx.Response(302, headers={"Location": "/middle?step=2"})
        if request.url.host == "source.test" and request.url.path == "/middle":
            return httpx.Response(
                307,
                headers={"Location": "https://destination.test/final"},
            )
        if request.url.host == "destination.test" and request.url.path == "/final":
            final_headers = request.headers
            return httpx.Response(200, text="ok")
        raise AssertionError(f"Unexpected request: {request.url}")

    async with make_client(httpx.MockTransport(handler)) as client:
        response = await client.get(
            "https://source.test/start#ignored",
            headers={
                "Authorization": "Bearer secret",
                "Cookie": "session=secret",
                "X-Api-Key": "secret-key",
                "X-Trace": "safe",
                "Host": "spoofed.test",
            },
        )

    assert response.text == "ok"
    assert requests == [
        "https://source.test/robots.txt",
        "https://source.test/start",
        "https://source.test/middle?step=2",
        "https://destination.test/robots.txt",
        "https://destination.test/final",
    ]
    assert final_headers is not None
    assert "authorization" not in final_headers
    assert "cookie" not in final_headers
    assert "x-api-key" not in final_headers
    assert final_headers["host"] == "destination.test"
    assert final_headers["x-trace"] == "safe"


@pytest.mark.asyncio
async def test_redirect_destination_is_not_requested_when_robots_denies_it() -> None:
    requests: list[str] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(str(request.url))
        if request.url.host == "source.test" and request.url.path == "/robots.txt":
            return httpx.Response(200, text=ALLOW_ALL)
        if request.url.host == "source.test" and request.url.path == "/start":
            return httpx.Response(
                302,
                headers={"Location": "https://blocked.test/private/report"},
            )
        if request.url.host == "blocked.test" and request.url.path == "/robots.txt":
            return httpx.Response(200, text="User-agent: *\nDisallow: /private\n")
        raise AssertionError("A robots-denied redirect destination was requested")

    async with make_client(httpx.MockTransport(handler)) as client:
        with pytest.raises(RobotsDeniedError):
            await client.get("https://source.test/start")

    assert requests[-1] == "https://blocked.test/robots.txt"
    assert "https://blocked.test/private/report" not in requests


@pytest.mark.asyncio
async def test_non_http_redirect_is_rejected_before_request() -> None:
    requests: list[str] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requests.append(str(request.url))
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text=ALLOW_ALL)
        return httpx.Response(302, headers={"Location": "file:///etc/passwd"})

    async with make_client(httpx.MockTransport(handler)) as client:
        with pytest.raises(UnsafeUrlError, match="Unsupported URL scheme"):
            await client.get("https://source.test/start")

    assert requests == [
        "https://source.test/robots.txt",
        "https://source.test/start",
    ]


@pytest.mark.asyncio
async def test_redirect_limit_is_enforced_without_requesting_next_target() -> None:
    requested_paths: list[str] = []

    async def handler(request: httpx.Request) -> httpx.Response:
        requested_paths.append(request.url.path)
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text=ALLOW_ALL)
        if request.url.path == "/start":
            return httpx.Response(302, headers={"Location": "/one"})
        if request.url.path == "/one":
            return httpx.Response(301, headers={"Location": "/two"})
        raise AssertionError("Redirect target beyond the configured limit was requested")

    async with make_client(httpx.MockTransport(handler), max_redirects=1) as client:
        with pytest.raises(TooManyRedirectsError):
            await client.get("https://source.test/start")

    assert requested_paths == ["/robots.txt", "/start", "/one"]


@pytest.mark.asyncio
async def test_redirect_without_location_is_an_error() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text=ALLOW_ALL)
        return httpx.Response(302)

    async with make_client(httpx.MockTransport(handler)) as client:
        with pytest.raises(RedirectError, match="has no Location"):
            await client.get("https://source.test/start")


@pytest.mark.asyncio
async def test_retry_after_is_honored_without_old_ten_second_truncation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    content_attempts = 0
    sleeps: list[float] = []

    async def fake_sleep(delay: float) -> None:
        sleeps.append(delay)

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal content_attempts
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text=ALLOW_ALL)
        content_attempts += 1
        if content_attempts == 1:
            return httpx.Response(429, headers={"Retry-After": "37"})
        return httpx.Response(200, text="recovered")

    monkeypatch.setattr(http_module.asyncio, "sleep", fake_sleep)
    async with make_client(httpx.MockTransport(handler), retries=1) as client:
        response = await client.get("https://source.test/report")

    assert response.text == "recovered"
    assert content_attempts == 2
    assert sleeps == [37.0]


@pytest.mark.asyncio
async def test_transport_error_retries_then_reports_source_unavailable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    content_attempts = 0
    sleeps: list[float] = []

    async def fake_sleep(delay: float) -> None:
        sleeps.append(delay)

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal content_attempts
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text=ALLOW_ALL)
        content_attempts += 1
        raise httpx.ConnectError("network unavailable", request=request)

    monkeypatch.setattr(http_module.asyncio, "sleep", fake_sleep)
    async with make_client(httpx.MockTransport(handler), retries=1) as client:
        with pytest.raises(SourceUnavailableError, match="Request failed"):
            await client.get("https://source.test/report")

    assert content_attempts == 2
    assert sleeps == [0.5]


@pytest.mark.asyncio
async def test_terminal_http_error_preserves_url_and_status() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text=ALLOW_ALL)
        return httpx.Response(404)

    async with make_client(httpx.MockTransport(handler)) as client:
        with pytest.raises(UnexpectedStatusError) as captured:
            await client.get("https://source.test/missing")

    assert captured.value.status_code == 404
    assert captured.value.url == "https://source.test/missing"
