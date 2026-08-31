"""Reusable adapter for public Google News sitemaps and article metadata."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any
from urllib.parse import unquote, urljoin, urlsplit

from bs4 import BeautifulSoup, Tag

from src.models.article import ArticleReference, ScrapedArticle
from src.scrapers.html import article_text, first_text, json_ld_nodes, parse_datetime
from src.scrapers.normalization import canonicalize_url, clean_text, concise_description
from src.sources.base import BaseNewsSource, UnexpectedHtmlError


def _news_article_node(soup: BeautifulSoup) -> dict[str, Any]:
    for node in json_ld_nodes(soup):
        schema_types = node.get("@type")
        values = schema_types if isinstance(schema_types, list) else [schema_types]
        if any(value in {"Article", "NewsArticle"} for value in values):
            return node
    return {}


def _xml_text(root: Tag, local_name: str) -> str:
    for element in root.find_all():
        if str(element.name).split(":")[-1] == local_name:
            return clean_text(element.get_text(" ", strip=True))
    return ""


class SitemapNewsSource(BaseNewsSource):
    """Base implementation for sources with a bounded public news sitemap."""

    sitemap_url: str
    title_selectors: tuple[str, ...] = ("article h1", "main h1", "h1")
    description_selectors: tuple[str, ...] = ()
    content_selectors: tuple[str, ...] = ("article",)
    minimum_content_length = 80

    def include_sitemap_item(
        self,
        *,
        url: str,
        title: str,
        keywords: str,
    ) -> bool:
        raise NotImplementedError

    def validate_article_url(self, url: str) -> str:
        return self.validate_url(url)

    async def discover(self) -> AsyncIterator[ArticleReference]:
        response = await self.client.get(self.sitemap_url)
        self.validate_url(str(response.url))
        document = BeautifulSoup(response.text, "xml")
        entries = document.find_all("url")
        if not entries:
            raise UnexpectedHtmlError(f"{self.name} news sitemap has no URL entries")

        seen: set[str] = set()
        for entry in entries:
            url = canonicalize_url(_xml_text(entry, "loc"))
            title = _xml_text(entry, "title")
            title_is_derived = False
            if url and not title:
                slug = unquote(urlsplit(url).path.rstrip("/").rsplit("/", 1)[-1])
                title = clean_text(slug.replace("-", " "))
                title_is_derived = True
            keywords = _xml_text(entry, "keywords")
            if not url or not title:
                continue
            # Validate the public source host before inspecting metadata, but do
            # not fail the whole sitemap merely because it also lists articles
            # outside the Bogotá section. The stricter article-path validation
            # applies only after the source-specific geographic filter accepts it.
            self.validate_url(url)
            if not self.include_sitemap_item(url=url, title=title, keywords=keywords):
                continue
            self.validate_article_url(url)
            if url in seen:
                continue
            seen.add(url)
            yield ArticleReference(
                source=self.name,
                title=title,
                url=url,
                publication_date=parse_datetime(
                    _xml_text(entry, "publication_date")
                    or _xml_text(entry, "lastmod"),
                    assume_bogota=True,
                ),
                title_is_derived=title_is_derived,
            )

    async def fetch_article(self, reference: ArticleReference) -> ScrapedArticle:
        requested_url = self.validate_article_url(str(reference.url))
        response = await self.client.get(requested_url)
        self.validate_url(str(response.url))
        soup = BeautifulSoup(response.text, "lxml")

        canonical_element = soup.select_one('link[rel~="canonical"][href]')
        canonical = canonicalize_url(
            urljoin(str(response.url), str(canonical_element.get("href")))
            if canonical_element
            else str(response.url)
        )
        self.validate_article_url(canonical)

        schema = _news_article_node(soup)
        title_element = self._first_element(soup, self.title_selectors)
        title = first_text(
            (
                title_element.get_text(" ", strip=True) if title_element else None,
                schema.get("headline") if isinstance(schema.get("headline"), str) else None,
                reference.title,
            )
        )
        if not title:
            raise UnexpectedHtmlError(f"{self.name} article has no title: {canonical}")

        description_element = self._first_element(soup, self.description_selectors)
        meta_description = soup.select_one('meta[name="description"][content]')
        og_description = soup.select_one('meta[property="og:description"][content]')
        description = first_text(
            (
                description_element.get_text(" ", strip=True)
                if description_element
                else None,
                meta_description.get("content") if meta_description else None,
                og_description.get("content") if og_description else None,
                schema.get("description")
                if isinstance(schema.get("description"), str)
                else None,
                reference.description,
            )
        )

        content_root = self._first_element(soup, self.content_selectors)
        content = article_text(content_root) if content_root is not None else ""
        if len(content) < self.minimum_content_length:
            schema_body = schema.get("articleBody")
            content = clean_text(schema_body) if isinstance(schema_body, str) else ""
        if len(content) < self.minimum_content_length:
            raise UnexpectedHtmlError(
                f"{self.name} article body was unavailable or too short: {canonical}"
            )

        published_meta = soup.select_one('meta[property="article:published_time"][content]')
        publication = parse_datetime(
            schema.get("datePublished")
            if isinstance(schema.get("datePublished"), str)
            else published_meta.get("content") if published_meta else None,
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

    @staticmethod
    def _first_element(
        soup: BeautifulSoup,
        selectors: tuple[str, ...],
    ) -> Tag | None:
        for selector in selectors:
            element = soup.select_one(selector)
            if element is not None:
                return element
        return None
