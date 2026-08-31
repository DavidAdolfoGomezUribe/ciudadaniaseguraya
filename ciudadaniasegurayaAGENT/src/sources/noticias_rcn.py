import unicodedata
from urllib.parse import urlsplit

from src.sources.sitemap_news import SitemapNewsSource


def _fold(value: str) -> str:
    return "".join(
        character
        for character in unicodedata.normalize("NFKD", value.casefold())
        if not unicodedata.combining(character)
    )


class NoticiasRCNSource(SitemapNewsSource):
    name = "Noticias RCN"
    allowed_hosts = frozenset({"noticiasrcn.com", "www.noticiasrcn.com"})
    sitemap_url = "https://www.noticiasrcn.com/sitemapnews"
    title_selectors = ("article h1.title", "h1.title", "article h1")
    description_selectors = ("article h2.lead", "h2.lead")
    content_selectors = ("article .standard-content .content", ".standard-content .content")

    def include_sitemap_item(
        self,
        *,
        url: str,
        title: str,
        keywords: str,
    ) -> bool:
        path = urlsplit(url).path
        if path.startswith("/bogota/"):
            return True
        return "bogota" in _fold(f"{title} {keywords}")

