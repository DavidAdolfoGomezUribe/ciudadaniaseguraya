import logging
from collections.abc import AsyncIterator
from urllib.parse import unquote, urljoin, urlsplit

from bs4 import BeautifulSoup

from src.models.article import ArticleReference, ScrapedArticle
from src.scrapers.html import (
    article_text,
    first_text,
    json_ld_node,
    parse_datetime,
)
from src.scrapers.normalization import canonicalize_url, clean_text, concise_description
from src.sources.base import BaseNewsSource, UnexpectedHtmlError

logger = logging.getLogger(__name__)


class BogotaGovSource(BaseNewsSource):
    name = "Bogotá.gov.co"
    allowed_hosts = frozenset({"bogota.gov.co", "www.bogota.gov.co"})
    section_url = "https://bogota.gov.co/mi-ciudad/seguridad"
    sitemap_url = "https://bogota.gov.co/sitemap.xml"
    sitemap_partition_sample = 20

    def __init__(self, client, *, max_pages: int = 40) -> None:
        super().__init__(client)
        self.max_pages = max_pages

    async def discover(self) -> AsyncIterator[ArticleReference]:
        seen: set[str] = set()
        for page in range(self.max_pages):
            page_url = self.section_url if page == 0 else f"{self.section_url}?page={page}"
            logger.info("Discovering %s page %s", self.name, page + 1)
            response = await self.client.get(page_url)
            soup = BeautifulSoup(response.text, "lxml")
            root = soup.select_one(
                "div.view-taxonomy-term-custom.view-id-taxonomy_term_custom"
            )
            if root is None:
                logger.warning(
                    "%s listing has no server-rendered news view; using its XML sitemap",
                    self.name,
                )
                async for reference in self._discover_from_sitemap(seen):
                    yield reference
                return

            cards = root.select(".view-content .tarjeta")
            if not cards:
                logger.info("No more %s cards after page %s", self.name, page + 1)
                return

            yielded_on_page = 0
            for card in cards:
                anchor = card.select_one(".views-field-title a[href]")
                if anchor is None:
                    continue
                url = canonicalize_url(urljoin(str(response.url), anchor["href"]))
                self.validate_url(url)
                if url in seen:
                    continue
                title = clean_text(anchor.get_text(" ", strip=True))
                if not title:
                    continue
                time_element = card.select_one(".views-field-created time[datetime]")
                publication = parse_datetime(
                    time_element.get("datetime") if time_element else None,
                    assume_bogota=True,
                )
                description_element = card.select_one(
                    ".views-field-field-sumario, .views-field-body"
                )
                seen.add(url)
                yielded_on_page += 1
                yield ArticleReference(
                    source=self.name,
                    title=title,
                    url=url,
                    publication_date=publication,
                    description=(
                        clean_text(description_element.get_text(" ", strip=True))
                        if description_element
                        else None
                    ),
                )

            if not yielded_on_page:
                return
            next_link = root.select_one('.pager__item--next a[rel="next"]')
            if next_link is None:
                return

    async def _discover_from_sitemap(
        self, seen: set[str]
    ) -> AsyncIterator[ArticleReference]:
        index_response = await self.client.get(self.sitemap_url)
        self.validate_url(str(index_response.url))
        index = BeautifulSoup(index_response.text, "xml")
        child_urls = [
            canonicalize_url(clean_text(element.get_text()))
            for element in index.select("sitemap > loc")
            if clean_text(element.get_text())
        ]
        if not child_urls:
            raise UnexpectedHtmlError(f"{self.name} sitemap index has no partitions")

        scanned = 0
        deferred_batches: list[list[str]] = []
        for sitemap_url in reversed(child_urls):
            if scanned >= self.max_pages:
                return
            # Sitemap indexes are untrusted input too. Never let a malformed
            # or compromised index turn this adapter into an arbitrary fetcher.
            self.validate_url(sitemap_url)
            scanned += 1
            logger.info(
                "Discovering %s sitemap partition %s/%s",
                self.name,
                scanned,
                self.max_pages,
            )
            response = await self.client.get(sitemap_url)
            self.validate_url(str(response.url))
            sitemap = BeautifulSoup(response.text, "xml")
            article_urls: list[str] = []
            for item in sitemap.find_all("url"):
                location = item.find("loc")
                if location is None:
                    continue
                url = canonicalize_url(clean_text(location.get_text()))
                path = urlsplit(url).path
                if not path.startswith("/mi-ciudad/seguridad/"):
                    continue
                self.validate_url(url)
                if url in seen:
                    continue
                seen.add(url)
                article_urls.append(url)

            # One Drupal partition currently contains hundreds of Security
            # nodes. Sampling evenly across its timeline prevents the newest
            # press-release format from starving older, fully evidenced news.
            ordered_urls = self._coverage_order(list(reversed(article_urls)))
            initial = ordered_urls[: self.sitemap_partition_sample]
            remainder = ordered_urls[self.sitemap_partition_sample :]
            if remainder:
                deferred_batches.append(remainder)
            for url in initial:
                slug = unquote(urlsplit(url).path.rstrip("/").rsplit("/", 1)[-1])
                yield ArticleReference(
                    source=self.name,
                    title=clean_text(slug.replace("-", " ")),
                    url=url,
                    title_is_derived=True,
                )

        # Continue breadth-first across every non-empty partition once each
        # has received an initial opportunity. This remains deterministic.
        if deferred_batches:
            longest = max(len(batch) for batch in deferred_batches)
            for index in range(longest):
                for batch in deferred_batches:
                    if index >= len(batch):
                        continue
                    url = batch[index]
                    slug = unquote(
                        urlsplit(url).path.rstrip("/").rsplit("/", 1)[-1]
                    )
                    yield ArticleReference(
                        source=self.name,
                        title=clean_text(slug.replace("-", " ")),
                        url=url,
                        title_is_derived=True,
                    )

    @staticmethod
    def _coverage_order(urls: list[str], *, lanes: int = 20) -> list[str]:
        """Interleave chronological slices while keeping recent items first."""

        if len(urls) <= lanes:
            return urls
        lane_size = (len(urls) + lanes - 1) // lanes
        ordered: list[str] = []
        for offset in range(lane_size):
            for start in range(0, len(urls), lane_size):
                index = start + offset
                if index < min(start + lane_size, len(urls)):
                    ordered.append(urls[index])
        return ordered

    async def fetch_article(self, reference: ArticleReference) -> ScrapedArticle:
        url = self.validate_url(str(reference.url))
        logger.info("Fetching %s article: %s", self.name, url)
        response = await self.client.get(url)
        self.validate_url(str(response.url))
        soup = BeautifulSoup(response.text, "lxml")

        canonical_element = soup.select_one('link[rel~="canonical"][href]')
        canonical = canonicalize_url(
            urljoin(str(response.url), canonical_element["href"])
            if canonical_element
            else str(response.url)
        )
        self.validate_url(canonical)

        article_schema = json_ld_node(soup, "Article") or {}
        # Bogotá.gov.co currently serves at least two Drupal article bundles.
        # Regular news uses ``v2024-article__title`` while video news uses
        # ``titulo-seccion``.  Both are visible editorial headings; the
        # JSON-LD headline remains a fallback because it can be SEO-shortened.
        title_element = soup.select_one("h1.v2024-article__title")
        if title_element is None:
            title_element = soup.select_one(
                "section.galeria-fotos--desc "
                ".galeria-fotos--body > h1.titulo-seccion"
            )
        title = first_text(
            (
                title_element.get_text(" ", strip=True) if title_element else None,
                article_schema.get("headline") if isinstance(article_schema.get("headline"), str) else None,
                None if reference.title_is_derived else reference.title,
            )
        )
        if not title:
            raise UnexpectedHtmlError(
                f"{self.name} article has no real editorial title: {canonical}"
            )
        summary_element = soup.select_one(".v2024-article__sumario")
        if summary_element is None:
            summary_element = soup.select_one(
                "section.galeria-fotos--desc .galeria-fotos--body > p"
            )
        meta_description = soup.select_one('meta[name="description"][content]')
        description = first_text(
            (
                summary_element.get_text(" ", strip=True) if summary_element else None,
                meta_description.get("content") if meta_description else None,
                article_schema.get("description") if isinstance(article_schema.get("description"), str) else None,
                reference.description,
            )
        )

        content_root = soup.select_one(
            "#v2024-article-content .field--name-body > .field__item"
        )
        if content_root is None:
            # In the video bundle the body field is itself the field item,
            # instead of wrapping a descendant named ``field__item``.
            content_root = soup.select_one(
                "#v2024-article-content.node-video_content-body "
                "> .field--name-body.field--item"
            )
        if content_root is None:
            raise UnexpectedHtmlError(f"{self.name} article body was not found: {canonical}")
        for social in content_root.select("blockquote.twitter-tweet"):
            social.decompose()
        content = article_text(content_root)
        if len(content) < 80:
            raise UnexpectedHtmlError(f"{self.name} article body was unexpectedly short")

        publication = parse_datetime(
            article_schema.get("datePublished")
            if isinstance(article_schema.get("datePublished"), str)
            else None,
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
