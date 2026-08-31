import asyncio
import logging
import time
from collections import defaultdict
from email.utils import parsedate_to_datetime
from urllib.parse import urljoin, urlsplit, urlunsplit
from urllib.robotparser import RobotFileParser

import httpx

logger = logging.getLogger(__name__)

_REDIRECT_STATUS_CODES = frozenset({301, 302, 303, 307, 308})
_SENSITIVE_REDIRECT_HEADERS = frozenset(
    {"authorization", "proxy-authorization", "cookie", "cookie2", "x-api-key"}
)


class ScraperError(RuntimeError):
    """Base error raised by the respectful HTTP layer."""


class RobotsDeniedError(ScraperError):
    pass


class SourceUnavailableError(ScraperError):
    pass


class UnsafeUrlError(ScraperError):
    pass


class RedirectError(ScraperError):
    pass


class TooManyRedirectsError(RedirectError):
    pass


class UnexpectedStatusError(ScraperError):
    def __init__(self, url: str, status_code: int) -> None:
        super().__init__(f"HTTP {status_code} while fetching {url}")
        self.url = url
        self.status_code = status_code


class RespectfulHttpClient:
    """Shared async client with robots checks, throttling, timeouts and retries."""

    def __init__(
        self,
        *,
        user_agent: str,
        timeout: float,
        request_delay: float,
        retries: int = 1,
        max_redirects: int = 5,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        if max_redirects < 0:
            raise ValueError("max_redirects must be non-negative")

        self.user_agent = user_agent
        self.request_delay = request_delay
        self.retries = retries
        self.max_redirects = max_redirects
        self._client = httpx.AsyncClient(
            headers={
                "User-Agent": user_agent,
                "Accept": "text/html,application/xhtml+xml,application/rss+xml,application/xml;q=0.9,*/*;q=0.5",
                "Accept-Language": "es-CO,es;q=0.9",
            },
            timeout=httpx.Timeout(timeout),
            # Redirects are followed below so robots.txt is checked before every hop.
            follow_redirects=False,
            transport=transport,
        )
        self._robots: dict[str, RobotFileParser | bool] = {}
        self._host_locks: defaultdict[str, asyncio.Lock] = defaultdict(asyncio.Lock)
        self._last_request: defaultdict[str, float] = defaultdict(float)

    async def __aenter__(self) -> "RespectfulHttpClient":
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        await self._client.aclose()

    @staticmethod
    def _validated_url(url: str) -> str:
        if any(character in url for character in ("\r", "\n", "\x00")):
            raise UnsafeUrlError("URL contains forbidden control characters")

        try:
            parsed = urlsplit(url)
            # Accessing port also validates malformed and out-of-range ports.
            parsed.port
        except ValueError as exc:
            raise UnsafeUrlError(f"Invalid URL: {url}") from exc

        scheme = parsed.scheme.lower()
        if scheme not in {"http", "https"}:
            raise UnsafeUrlError(f"Unsupported URL scheme: {parsed.scheme or '(missing)'}")
        if not parsed.netloc or parsed.hostname is None:
            raise UnsafeUrlError(f"URL does not contain a valid host: {url}")
        if parsed.username is not None or parsed.password is not None:
            raise UnsafeUrlError("Credentials embedded in URLs are not allowed")

        # Fragments are never sent and must not affect robots or redirect checks.
        return urlunsplit((scheme, parsed.netloc, parsed.path, parsed.query, ""))

    @classmethod
    def _origin(cls, url: str) -> str:
        parsed = urlsplit(cls._validated_url(url))
        host = parsed.hostname or ""
        host = f"[{host}]" if ":" in host else host
        default_port = 80 if parsed.scheme == "http" else 443
        authority = host if parsed.port in {None, default_port} else f"{host}:{parsed.port}"
        return f"{parsed.scheme}://{authority.lower()}"

    async def _throttled_send(self, url: str, **kwargs: object) -> httpx.Response:
        host = urlsplit(url).netloc.lower()
        async with self._host_locks[host]:
            elapsed = time.monotonic() - self._last_request[host]
            if elapsed < self.request_delay:
                await asyncio.sleep(self.request_delay - elapsed)
            try:
                response = await self._client.get(url, **kwargs)
            finally:
                self._last_request[host] = time.monotonic()
            return response

    async def _send_with_retries(
        self,
        url: str,
        *,
        headers: dict[str, str] | None = None,
    ) -> httpx.Response:
        for attempt in range(self.retries + 1):
            try:
                response = await self._throttled_send(url, headers=headers)
            except httpx.TransportError as exc:
                if attempt >= self.retries:
                    raise SourceUnavailableError(f"Request failed for {url}: {exc}") from exc
                await asyncio.sleep(0.5 * (2**attempt))
                continue

            if (
                response.status_code == 429 or response.status_code >= 500
            ) and attempt < self.retries:
                retry_after = response.headers.get("Retry-After")
                delay = self._retry_delay(retry_after, attempt)
                await response.aclose()
                # Retry-After is a server policy boundary; never silently shorten it.
                await asyncio.sleep(delay)
                continue

            return response

        raise AssertionError("retry loop must return or raise")

    def _redirect_target(self, response: httpx.Response) -> str:
        location = response.headers.get("Location")
        if not location:
            raise RedirectError(
                f"HTTP {response.status_code} redirect from {response.url} has no Location"
            )
        return self._validated_url(urljoin(str(response.url), location))

    @classmethod
    def _redirect_headers(
        cls,
        headers: dict[str, str] | None,
        source_url: str,
        destination_url: str,
    ) -> dict[str, str] | None:
        if headers is None:
            return None

        cross_origin = cls._origin(source_url) != cls._origin(destination_url)
        return {
            name: value
            for name, value in headers.items()
            if name.lower() != "host"
            and not (cross_origin and name.lower() in _SENSITIVE_REDIRECT_HEADERS)
        }

    async def _load_robots(self, url: str) -> RobotFileParser | bool:
        origin = self._origin(url)
        if origin in self._robots:
            return self._robots[origin]

        robots_url = self._validated_url(f"{origin}/robots.txt")
        current_url = robots_url
        redirect_count = 0

        while True:
            try:
                response = await self._send_with_retries(current_url)
            except SourceUnavailableError as exc:
                raise SourceUnavailableError(
                    f"Could not verify robots.txt for {origin}: {exc}"
                ) from exc

            if response.status_code in _REDIRECT_STATUS_CODES:
                if redirect_count >= self.max_redirects:
                    await response.aclose()
                    raise SourceUnavailableError(
                        f"Could not verify robots.txt for {origin}: too many redirects"
                    )
                try:
                    destination = self._redirect_target(response)
                except (RedirectError, UnsafeUrlError) as exc:
                    await response.aclose()
                    raise SourceUnavailableError(
                        f"Could not verify robots.txt for {origin}: {exc}"
                    ) from exc
                await response.aclose()
                current_url = destination
                redirect_count += 1
                continue

            if 300 <= response.status_code < 400:
                status_code = response.status_code
                await response.aclose()
                raise SourceUnavailableError(
                    f"Could not verify robots.txt for {origin}: HTTP {status_code}"
                )
            if response.status_code == 404:
                await response.aclose()
                self._robots[origin] = True
                return True
            if response.status_code in {401, 403}:
                await response.aclose()
                self._robots[origin] = False
                return False
            if response.status_code >= 400:
                status_code = response.status_code
                await response.aclose()
                raise SourceUnavailableError(
                    f"Could not verify robots.txt for {origin}: HTTP {status_code}"
                )

            parser = RobotFileParser(robots_url)
            parser.parse(response.text.splitlines())
            await response.aclose()
            self._robots[origin] = parser
            return parser

    async def _assert_allowed(self, url: str) -> None:
        policy = await self._load_robots(url)
        allowed = policy is True or (
            isinstance(policy, RobotFileParser) and policy.can_fetch(self.user_agent, url)
        )
        if not allowed:
            raise RobotsDeniedError(f"robots.txt does not allow fetching {url}")

    async def get(
        self,
        url: str,
        *,
        headers: dict[str, str] | None = None,
        check_robots: bool = True,
    ) -> httpx.Response:
        current_url = self._validated_url(url)
        current_headers = dict(headers) if headers is not None else None
        redirect_count = 0

        while True:
            if check_robots:
                await self._assert_allowed(current_url)

            response = await self._send_with_retries(
                current_url,
                headers=current_headers,
            )

            if response.status_code in _REDIRECT_STATUS_CODES:
                if redirect_count >= self.max_redirects:
                    await response.aclose()
                    raise TooManyRedirectsError(
                        f"More than {self.max_redirects} redirects while fetching {url}"
                    )
                try:
                    destination = self._redirect_target(response)
                except (RedirectError, UnsafeUrlError):
                    await response.aclose()
                    raise

                next_headers = self._redirect_headers(
                    current_headers,
                    current_url,
                    destination,
                )
                await response.aclose()
                current_headers = next_headers
                current_url = destination
                redirect_count += 1
                continue

            if response.status_code >= 300:
                status_code = response.status_code
                response_url = str(response.url)
                await response.aclose()
                raise UnexpectedStatusError(response_url, status_code)

            return response

    @staticmethod
    def _retry_delay(retry_after: str | None, attempt: int) -> float:
        if retry_after:
            try:
                return max(float(retry_after), 0.0)
            except ValueError:
                try:
                    target = parsedate_to_datetime(retry_after)
                    return max(target.timestamp() - time.time(), 0.0)
                except (TypeError, ValueError, OverflowError):
                    pass
        return 0.5 * (2**attempt)
