from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from urllib.parse import urlsplit

from src.models.article import ArticleReference, ScrapedArticle
from src.scrapers.http import RespectfulHttpClient, ScraperError


class UnexpectedHtmlError(ScraperError):
    pass


class BaseNewsSource(ABC):
    """Replaceable contract implemented by every news portal adapter."""

    name: str
    allowed_hosts: frozenset[str]

    def __init__(self, client: RespectfulHttpClient) -> None:
        self.client = client

    def validate_url(self, url: str) -> str:
        parsed = urlsplit(url)
        if parsed.scheme != "https" or parsed.hostname not in self.allowed_hosts:
            raise UnexpectedHtmlError(f"Unexpected article URL for {self.name}: {url}")
        return url

    @abstractmethod
    async def discover(self) -> AsyncIterator[ArticleReference]:
        """Yield lightweight references in source-defined recency order."""
        if False:  # pragma: no cover - makes this an async generator contract
            yield ArticleReference(source="x", title="x", url="https://example.com")

    @abstractmethod
    async def fetch_article(self, reference: ArticleReference) -> ScrapedArticle:
        """Download and normalize one article without interpreting it."""
