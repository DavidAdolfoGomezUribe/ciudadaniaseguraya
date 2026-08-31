from collections.abc import AsyncIterator

from src.models.article import ArticleReference, ScrapedArticle
from src.scrapers.normalization import canonicalize_url


class SnapshotNewsSource:
    """Read-only source over an already collected dataset; performs no HTTP."""

    name = "Collected dataset"

    def __init__(self, articles: list[ScrapedArticle]) -> None:
        self.articles = articles
        self._by_url = {
            canonicalize_url(str(article.url)): article for article in articles
        }

    async def discover(self) -> AsyncIterator[ArticleReference]:
        for article in self.articles:
            yield ArticleReference(
                source=article.source,
                title=article.title,
                url=article.url,
                publication_date=article.publication_date,
                description=article.description,
            )

    async def fetch_article(self, reference: ArticleReference) -> ScrapedArticle:
        return self._by_url[canonicalize_url(str(reference.url))]
