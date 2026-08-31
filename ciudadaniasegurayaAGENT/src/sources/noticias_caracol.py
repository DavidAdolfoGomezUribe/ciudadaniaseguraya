from urllib.parse import urlsplit

from src.sources.base import UnexpectedHtmlError
from src.sources.sitemap_news import SitemapNewsSource


class NoticiasCaracolSource(SitemapNewsSource):
    name = "Noticias Caracol"
    allowed_hosts = frozenset({"noticiascaracol.com", "www.noticiascaracol.com"})
    sitemap_url = "https://www.noticiascaracol.com/content-sitemap-latest.xml"
    title_selectors = ("h1.ArticleLargeTitle-headline", "article h1", "main h1")
    description_selectors = (".ArticleLargeTitle-lead", ".ArticleLargeTitle-description")
    content_selectors = (".RichTextArticleBody-body", ".RichTextArticleBody")

    def include_sitemap_item(
        self,
        *,
        url: str,
        title: str,
        keywords: str,
    ) -> bool:
        return urlsplit(url).path.startswith("/colombia/bogota/")

    def validate_article_url(self, url: str) -> str:
        validated = self.validate_url(url)
        if not urlsplit(validated).path.startswith("/colombia/bogota/"):
            raise UnexpectedHtmlError(
                f"Noticias Caracol URL is not a Bogotá article: {url}"
            )
        return validated
