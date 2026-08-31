from urllib.parse import urlsplit

from src.sources.base import UnexpectedHtmlError
from src.sources.sitemap_news import SitemapNewsSource


class ElEspectadorSource(SitemapNewsSource):
    name = "El Espectador"
    allowed_hosts = frozenset({"elespectador.com", "www.elespectador.com"})
    sitemap_url = (
        "https://www.elespectador.com/arc/outboundfeeds/"
        "sitemap/section/bogota/?outputType=xml&size=100&from=0"
    )
    title_selectors = ("h1.ArticleHeader-Title", "article h1", "main h1")
    description_selectors = ("h2.ArticleHeader-Hook",)
    content_selectors = ("article .Article-Content", "article")

    def include_sitemap_item(
        self,
        *,
        url: str,
        title: str,
        keywords: str,
    ) -> bool:
        return urlsplit(url).path.startswith("/bogota/")

    def validate_article_url(self, url: str) -> str:
        validated = self.validate_url(url)
        if not urlsplit(validated).path.startswith("/bogota/"):
            raise UnexpectedHtmlError(
                f"El Espectador URL is not a Bogotá article: {url}"
            )
        return validated
