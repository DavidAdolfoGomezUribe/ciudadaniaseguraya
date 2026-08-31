from pathlib import Path

import httpx
import pytest

from src.models.article import ArticleReference
from src.sources.base import UnexpectedHtmlError
from src.sources.bogota_gov import BogotaGovSource
from src.sources.canal_capital import CanalCapitalSource

FIXTURES = Path(__file__).parent / "fixtures"


class FakeClient:
    def __init__(self, responses: dict[str, str]):
        self.responses = responses
        self.requested: list[str] = []

    async def get(self, url: str):
        self.requested.append(url)
        return httpx.Response(
            200,
            text=self.responses[url],
            request=httpx.Request("GET", url),
        )


def fixture(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


@pytest.mark.asyncio
async def test_bogota_parser_uses_scoped_view_and_visible_article_fields() -> None:
    listing = BogotaGovSource.section_url
    article_url = (
        "https://bogota.gov.co/mi-ciudad/seguridad/robo-prueba-barrio-restrepo"
    )
    source = BogotaGovSource(
        FakeClient(
            {
                listing: fixture("bogota_listing.html"),
                article_url: fixture("bogota_article.html"),
            }
        ),
        max_pages=1,
    )

    reference = await anext(source.discover())
    article = await source.fetch_article(reference)

    assert reference.title == "Hombre fue capturado por robo en el barrio Restrepo"
    assert article.title == reference.title
    assert str(article.url) == article_url
    assert article.publication_date.isoformat() == "2026-08-21T10:00:00-05:00"
    assert "cuerpo duplicado" not in article.content
    assert "otro homicidio" not in article.content


@pytest.mark.asyncio
async def test_bogota_parser_supports_video_article_bundle() -> None:
    article_url = (
        "https://bogota.gov.co/mi-ciudad/seguridad/"
        "capturados-dos-extorsionistas-en-bogota"
    )
    source = BogotaGovSource(
        FakeClient({article_url: fixture("bogota_video_article.html")}),
        max_pages=1,
    )
    reference = ArticleReference(
        source=source.name,
        title="capturados dos extorsionistas en bogota",
        url=article_url,
    )

    article = await source.fetch_article(reference)

    assert article.title == "Capturados dos presuntos extorsionistas en Bogotá"
    assert article.description == "Los hechos fueron esclarecidos por la Policía Metropolitana."
    assert article.publication_date.isoformat() == "2026-08-28T11:30:00-05:00"
    assert "La extorsión ocurrió" in article.content
    assert "señuelo" not in article.content


@pytest.mark.asyncio
async def test_bogota_sitemap_fallback_is_bounded_filtered_and_deduplicated() -> None:
    old_partition = "https://bogota.gov.co/sitemap.xml?page=1"
    current_partition = "https://bogota.gov.co/sitemap.xml?page=2"
    article_url = (
        "https://bogota.gov.co/mi-ciudad/seguridad/"
        "hurto-prueba-barrio-modelia"
    )
    index = f"""
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <sitemap><loc>{old_partition.replace('&', '&amp;')}</loc></sitemap>
          <sitemap><loc>{current_partition.replace('&', '&amp;')}</loc></sitemap>
        </sitemapindex>
    """
    partition = f"""
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <url><loc>{article_url}?utm_source=test</loc></url>
          <url><loc>{article_url}</loc></url>
          <url><loc>https://bogota.gov.co/mi-ciudad/movilidad/otra-noticia</loc></url>
        </urlset>
    """
    client = FakeClient(
        {
            BogotaGovSource.section_url: "<html><body>Sin vista</body></html>",
            BogotaGovSource.sitemap_url: index,
            current_partition: partition,
        }
    )
    source = BogotaGovSource(client, max_pages=1)

    references = [reference async for reference in source.discover()]

    assert [str(reference.url) for reference in references] == [article_url]
    assert references[0].title == "hurto prueba barrio modelia"
    assert references[0].title_is_derived is True
    assert current_partition in client.requested
    assert old_partition not in client.requested


@pytest.mark.asyncio
async def test_bogota_rejects_cross_host_sitemap_partition_before_fetch() -> None:
    malicious_partition = "https://evil.example/sitemap.xml"
    index = f"""
        <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
          <sitemap><loc>{malicious_partition}</loc></sitemap>
        </sitemapindex>
    """
    client = FakeClient(
        {
            BogotaGovSource.section_url: "<html><body>Sin vista</body></html>",
            BogotaGovSource.sitemap_url: index,
        }
    )
    source = BogotaGovSource(client, max_pages=1)

    with pytest.raises(UnexpectedHtmlError):
        await anext(source.discover())

    assert malicious_partition not in client.requested


def test_bogota_coverage_order_spans_a_large_partition_early() -> None:
    urls = [f"https://bogota.gov.co/noticia-{index}" for index in range(100)]

    ordered = BogotaGovSource._coverage_order(urls, lanes=10)

    assert ordered[:10] == [urls[index] for index in range(0, 100, 10)]
    assert sorted(ordered) == sorted(urls)


@pytest.mark.asyncio
async def test_canal_parser_discovers_rss_but_confirms_html_canonical() -> None:
    feed_url = CanalCapitalSource.security_feed
    article_url = (
        "https://www.canalcapital.gov.co/actualidad/atraco-prueba-restrepo/"
    )
    source = CanalCapitalSource(
        FakeClient(
            {
                feed_url: fixture("canal_feed.xml"),
                article_url: fixture("canal_article.html"),
            }
        ),
        feed_pages=1,
    )

    reference = await anext(source.discover())
    article = await source.fetch_article(reference)

    assert reference.content_html is not None
    assert "appeared first" not in (reference.description or "")
    assert article.title == "Atraco a comerciante fue reportado en el barrio Restrepo"
    assert str(article.url) == article_url
    assert "estadísticas de homicidios" not in article.content
