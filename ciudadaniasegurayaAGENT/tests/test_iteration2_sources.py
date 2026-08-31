from pathlib import Path

import httpx
import pytest

from src.sources.el_espectador import ElEspectadorSource
from src.sources.noticias_caracol import NoticiasCaracolSource
from src.sources.noticias_rcn import NoticiasRCNSource

FIXTURES = Path(__file__).parent / "fixtures"


class FakeClient:
    def __init__(self, responses: dict[str, str]) -> None:
        self.responses = responses
        self.requested: list[str] = []

    async def get(self, url: str) -> httpx.Response:
        self.requested.append(url)
        return httpx.Response(
            200,
            text=self.responses[url],
            request=httpx.Request("GET", url),
        )


def fixture(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("source_type", "sitemap_fixture", "article_fixture", "article_url"),
    [
        (
            ElEspectadorSource,
            "el_espectador_sitemap.xml",
            "el_espectador_article.html",
            "https://www.elespectador.com/bogota/robo-en-el-barrio-restrepo/",
        ),
        (
            NoticiasRCNSource,
            "noticias_rcn_sitemap.xml",
            "noticias_rcn_article.html",
            "https://www.noticiasrcn.com/colombia/robo-en-bogota-123",
        ),
        (
            NoticiasCaracolSource,
            "noticias_caracol_sitemap.xml",
            "noticias_caracol_article.html",
            "https://www.noticiascaracol.com/colombia/bogota/choque-en-el-barrio-modelia-ab12",
        ),
    ],
)
async def test_new_source_discovers_bogota_and_extracts_canonical_article(
    source_type,
    sitemap_fixture: str,
    article_fixture: str,
    article_url: str,
) -> None:
    sitemap_url = source_type.sitemap_url
    source = source_type(
        FakeClient(
            {
                sitemap_url: fixture(sitemap_fixture),
                article_url: fixture(article_fixture),
            }
        )
    )

    references = [reference async for reference in source.discover()]
    article = await source.fetch_article(references[0])

    assert len(references) == 1
    assert str(article.url) == article_url
    assert article.publication_date is not None
    assert article.publication_date.utcoffset() is not None
    assert len(article.content) >= 80
    assert article.title == references[0].title


@pytest.mark.asyncio
async def test_el_espectador_section_sitemap_derives_title_and_lastmod() -> None:
    article_url = (
        "https://www.elespectador.com/bogota/armas-traumaticas-en-atracos-"
        "hombre-fue-herido-durante-un-robo-en-el-norte-de-bogota/"
    )
    sitemap = f"""<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url>
        <loc>{article_url}</loc>
        <lastmod>2026-08-28T20:05:16.437Z</lastmod>
      </url>
    </urlset>"""
    source = ElEspectadorSource(FakeClient({ElEspectadorSource.sitemap_url: sitemap}))

    references = [reference async for reference in source.discover()]

    assert len(references) == 1
    assert references[0].title_is_derived is True
    assert references[0].title.startswith("armas traumaticas en atracos")
    assert references[0].publication_date is not None
    assert references[0].publication_date.isoformat() == "2026-08-28T20:05:16.437000+00:00"
