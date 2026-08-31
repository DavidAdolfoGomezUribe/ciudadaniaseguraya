import logging
from collections.abc import AsyncIterator
from urllib.parse import urlencode, urljoin, urlsplit

import feedparser
from bs4 import BeautifulSoup

from src.models.article import ArticleReference, ScrapedArticle
from src.scrapers.html import (
    article_text,
    first_text,
    json_ld_node,
    parse_datetime,
    text_from_html,
)
from src.scrapers.http import UnexpectedStatusError
from src.scrapers.normalization import canonicalize_url, clean_text, concise_description
from src.sources.base import BaseNewsSource, UnexpectedHtmlError

logger = logging.getLogger(__name__)


class CanalCapitalSource(BaseNewsSource):
    name = "Canal Capital"
    allowed_hosts = frozenset({"canalcapital.gov.co", "www.canalcapital.gov.co"})
    security_feed = "https://www.canalcapital.gov.co/etiqueta/seguridad/feed/"
    search_terms = (
        "hurto",
        "robo",
        "atraco",
        "homicidio",
        "agresión",
        "secuestro",
        "extorsión",
        "vandalismo",
        "incendio",
        "accidente de tránsito",
        "explosión",
    )

    def __init__(self, client, *, feed_pages: int = 3) -> None:
        super().__init__(client)
        self.feed_pages = feed_pages

    async def discover(self) -> AsyncIterator[ArticleReference]:
        seen: set[str] = set()
        feed_specs: list[tuple[str, dict[str, str]]] = [
            (self.security_feed, {}),
            *(
                (
                    "https://www.canalcapital.gov.co/",
                    {"s": term, "feed": "rss2"},
                )
                for term in self.search_terms
            ),
        ]

        for base_url, base_query in feed_specs:
            for page in range(1, self.feed_pages + 1):
                query = dict(base_query)
                if page > 1:
                    query["paged"] = str(page)
                feed_url = base_url
                if query:
                    feed_url = f"{base_url}?{urlencode(query)}"
                elif page > 1:
                    feed_url = f"{base_url}?paged={page}"

                logger.info("Discovering %s feed: %s", self.name, feed_url)
                try:
                    response = await self.client.get(feed_url)
                except UnexpectedStatusError as exc:
                    if exc.status_code == 404 and page > 1:
                        break
                    raise

                parsed = feedparser.parse(response.content)
                entries = list(parsed.entries)
                if not entries:
                    break

                yielded_on_page = 0
                for entry in entries:
                    link = canonicalize_url(str(entry.get("link", "")))
                    if not link:
                        continue
                    self.validate_url(link)
                    if link in seen:
                        continue
                    title = clean_text(str(entry.get("title", "")))
                    if not title:
                        continue
                    encoded = entry.get("content") or []
                    content_html = (
                        str(encoded[0].get("value", ""))
                        if encoded and isinstance(encoded[0], dict)
                        else None
                    )
                    description_html = str(entry.get("description", ""))
                    description = self._clean_feed_description(description_html)
                    publication = parse_datetime(
                        str(entry.get("published", "")), assume_bogota=True
                    )
                    seen.add(link)
                    yielded_on_page += 1
                    yield ArticleReference(
                        source=self.name,
                        title=title,
                        url=link,
                        publication_date=publication,
                        description=description or None,
                        content_html=content_html,
                    )
                if not yielded_on_page:
                    break

    @staticmethod
    def _clean_feed_description(fragment: str) -> str:
        soup = BeautifulSoup(fragment, "lxml")
        for paragraph in soup.select("p"):
            text = clean_text(paragraph.get_text(" ", strip=True)).casefold()
            if text.startswith("the post ") and " appeared first on " in text:
                paragraph.decompose()
        return clean_text(soup.get_text(" ", strip=True))

    async def fetch_article(self, reference: ArticleReference) -> ScrapedArticle:
        url = self.validate_url(str(reference.url))
        logger.info("Fetching %s article: %s", self.name, url)
        response = await self.client.get(url)
        soup = BeautifulSoup(response.text, "lxml")

        canonical_element = soup.select_one('link[rel="canonical"][href]')
        canonical = canonicalize_url(
            urljoin(str(response.url), canonical_element["href"])
            if canonical_element
            else str(response.url)
        )
        self.validate_url(canonical)
        path = urlsplit(canonical).path.casefold()
        if path in {"/", "/ahora/"} or path.startswith(
            ("/categoria/", "/etiqueta/", "/author/", "/feed/")
        ):
            raise UnexpectedHtmlError(f"Canal Capital canonical is not an article: {canonical}")

        article_schema = json_ld_node(soup, "Article") or {}
        page_schema = json_ld_node(soup, "WebPage") or {}
        title_element = soup.select_one(
            "main#cptl-main-container h1.wp-block-post-title"
        )
        title = first_text(
            (
                title_element.get_text(" ", strip=True) if title_element else None,
                article_schema.get("headline") if isinstance(article_schema.get("headline"), str) else None,
                reference.title,
            )
        )

        excerpt = soup.select_one(
            ".wp-block-post-excerpt .wp-block-post-excerpt__excerpt"
        )
        meta_description = soup.select_one('meta[name="description"][content]')
        og_description = soup.select_one('meta[property="og:description"][content]')
        description = first_text(
            (
                excerpt.get_text(" ", strip=True) if excerpt else None,
                meta_description.get("content") if meta_description else None,
                og_description.get("content") if og_description else None,
                page_schema.get("description") if isinstance(page_schema.get("description"), str) else None,
                reference.description,
            )
        )

        content_root = soup.select_one(
            "main#cptl-main-container .entry-content.wp-block-post-content"
        )
        if content_root is not None:
            content = article_text(content_root)
        elif reference.content_html:
            rss_root = BeautifulSoup(reference.content_html, "lxml")
            content = article_text(rss_root)
        else:
            raise UnexpectedHtmlError(f"Canal Capital article body was not found: {canonical}")
        if len(content) < 80:
            raise UnexpectedHtmlError("Canal Capital article body was unexpectedly short")

        published_meta = soup.select_one('meta[property="article:published_time"][content]')
        published_time = soup.select_one(".wp-block-post-date time[datetime]")
        publication = parse_datetime(
            article_schema.get("datePublished")
            if isinstance(article_schema.get("datePublished"), str)
            else (
                published_meta.get("content")
                if published_meta
                else published_time.get("datetime") if published_time else None
            ),
            assume_bogota=True,
        ) or reference.publication_date

        return ScrapedArticle(
            source=self.name,
            title=title,
            url=canonical,
            publication_date=publication,
            description=concise_description(description) if description else None,
            content=content,
        )
