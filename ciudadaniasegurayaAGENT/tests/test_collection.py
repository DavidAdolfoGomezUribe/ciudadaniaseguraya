from datetime import datetime

import pytest

from src.models.article import ArticleReference, ScrapedArticle
from src.services.collection_service import (
    CollectionService,
    load_articles_jsonl,
    save_articles_jsonl,
)
from src.sources.snapshot import SnapshotNewsSource


class FakeClient:
    def __init__(self) -> None:
        self.closed = False

    async def aclose(self) -> None:
        self.closed = True


class FakeSource:
    def __init__(self, name: str, count: int) -> None:
        self.name = name
        self.count = count

    async def discover(self):
        for index in range(self.count):
            yield ArticleReference(
                source=self.name,
                title=f"Article {index} from {self.name}",
                url=f"https://example.com/{self.name.casefold().replace(' ', '-')}/{index}",
                publication_date=datetime.fromisoformat(
                    "2026-08-29T10:00:00-05:00"
                ),
            )

    async def fetch_article(self, reference: ArticleReference) -> ScrapedArticle:
        return ScrapedArticle(
            source=self.name,
            title=reference.title,
            url=reference.url,
            publication_date=reference.publication_date,
            description="A normalized article collected for comparative analysis.",
            content=(
                "This is normalized article content with enough text to satisfy "
                "the intermediate source contract."
            ),
        )


class BrokenSource:
    name = "Broken"

    async def discover(self):
        raise RuntimeError("source unavailable")
        yield  # pragma: no cover


class MixedReferenceSource(FakeSource):
    async def discover(self):
        titles = (
            "Programación cultural para este fin de semana",
            "Pico y placa para el lunes",
            "Hombre fue capturado por fuga de presos en el barrio Marly",
        )
        for index, title in enumerate(titles):
            yield ArticleReference(
                source=self.name,
                title=title,
                url=f"https://example.com/mixed/{index}",
                publication_date=datetime.fromisoformat(
                    "2026-08-29T10:00:00-05:00"
                ),
            )


@pytest.mark.asyncio
async def test_collection_reaches_100_unique_articles_round_robin() -> None:
    sources = [FakeSource(f"Source {index}", 30) for index in range(5)]
    service = CollectionService(
        client=FakeClient(),
        sources=sources,
        max_collection_limit=100,
        maximum_articles_processed=150,
    )

    result = await service.collect(limit=100)

    assert len(result.articles) == 100
    assert result.stats.articles_collected == 100
    assert result.stats.source_distribution == {
        source.name: 20 for source in sources
    }


@pytest.mark.asyncio
async def test_collection_isolates_a_failed_source() -> None:
    service = CollectionService(
        client=FakeClient(),
        sources=[BrokenSource(), FakeSource("Working", 2)],
        max_collection_limit=100,
        maximum_articles_processed=10,
    )

    result = await service.collect(limit=2)

    assert len(result.articles) == 2
    assert "Broken" in result.stats.source_errors


@pytest.mark.asyncio
async def test_collection_filters_discovery_metadata_before_fetching() -> None:
    source = MixedReferenceSource("Mixed", 3)
    service = CollectionService(
        client=FakeClient(),
        sources=[source],
        max_collection_limit=100,
        maximum_articles_processed=10,
        reference_filter=lambda reference: "capturado" in reference.title.casefold(),
    )

    result = await service.collect(limit=1)

    assert [article.title for article in result.articles] == [
        "Hombre fue capturado por fuga de presos en el barrio Marly"
    ]
    assert result.stats.articles_discovered == 3
    assert result.stats.articles_fetched == 1
    assert result.stats.references_filtered == 2


def test_jsonl_snapshot_round_trip_uses_the_same_articles(tmp_path) -> None:
    article = ScrapedArticle(
        source="Source",
        title="One reproducible article",
        url="https://example.com/article",
        publication_date=datetime.fromisoformat("2026-08-29T10:00:00-05:00"),
        description="A short normalized description.",
        content="Normalized article content that is long enough for the model.",
    )
    path = tmp_path / "articles.jsonl"

    save_articles_jsonl([article], path)
    loaded = load_articles_jsonl(path)

    assert loaded == [article]


def test_jsonl_snapshot_rejects_duplicate_inputs(tmp_path) -> None:
    item = ScrapedArticle(
        source="Source",
        title="One duplicated article",
        url="https://example.com/duplicate",
        publication_date=datetime.fromisoformat("2026-08-29T10:00:00-05:00"),
        description="A short normalized description.",
        content="Normalized article content that is long enough for the model.",
    )
    path = tmp_path / "duplicates.jsonl"
    save_articles_jsonl([item, item], path)

    with pytest.raises(ValueError, match="Duplicate article"):
        load_articles_jsonl(path)


@pytest.mark.asyncio
async def test_same_snapshot_replays_exact_articles_without_redownload() -> None:
    expected = [
        ScrapedArticle(
            source="Source",
            title=f"Dataset article {index}",
            url=f"https://example.com/dataset/{index}",
            publication_date=datetime.fromisoformat("2026-08-29T10:00:00-05:00"),
            description="A short normalized description.",
            content="Normalized article content that is long enough for both paths.",
        )
        for index in range(3)
    ]
    source = SnapshotNewsSource(expected)

    references = [reference async for reference in source.discover()]
    replayed = [await source.fetch_article(reference) for reference in references]

    assert replayed == expected
