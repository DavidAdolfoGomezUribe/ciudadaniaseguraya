"""Round-robin collection of reproducible normalized article snapshots."""

from __future__ import annotations

import json
import logging
import time
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from collections.abc import Callable
from typing import Any

from pydantic import ValidationError

from src.models.article import ArticleReference, ScrapedArticle
from src.scrapers.http import RespectfulHttpClient
from src.scrapers.normalization import canonicalize_url, clean_text, title_fingerprint
from src.sources.base import BaseNewsSource

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class CollectionStats:
    sources_checked: int = 0
    articles_discovered: int = 0
    articles_fetched: int = 0
    articles_collected: int = 0
    duplicates: int = 0
    article_errors: int = 0
    references_filtered: int = 0
    execution_time: float = 0.0
    source_distribution: Counter[str] = field(default_factory=Counter)
    source_errors: dict[str, str] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "sourcesChecked": self.sources_checked,
            "articlesDiscovered": self.articles_discovered,
            "articlesFetched": self.articles_fetched,
            "articlesCollected": self.articles_collected,
            "duplicates": self.duplicates,
            "articleErrors": self.article_errors,
            "referencesFiltered": self.references_filtered,
            "executionTimeSeconds": round(self.execution_time, 3),
            "sourceDistribution": dict(self.source_distribution),
            "sourceErrors": self.source_errors,
        }


@dataclass(slots=True)
class CollectionResult:
    articles: list[ScrapedArticle]
    stats: CollectionStats


class CollectionService:
    """Collect articles without deciding whether they are valid incidents."""

    def __init__(
        self,
        *,
        client: RespectfulHttpClient,
        sources: list[BaseNewsSource],
        max_collection_limit: int,
        maximum_articles_processed: int,
        reference_filter: Callable[[ArticleReference], bool] | None = None,
    ) -> None:
        self.client = client
        self.sources = sources
        self.max_collection_limit = max_collection_limit
        self.maximum_articles_processed = maximum_articles_processed
        self.reference_filter = reference_filter

    async def __aenter__(self) -> "CollectionService":
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        await self.client.aclose()

    async def collect(
        self,
        *,
        limit: int,
        on_progress: Callable[[dict[str, Any]], None] | None = None,
        should_cancel: Callable[[], bool] | None = None,
    ) -> CollectionResult:
        if not 1 <= limit <= self.max_collection_limit:
            raise ValueError(
                f"collection limit must be between 1 and {self.max_collection_limit}"
            )

        started = time.monotonic()
        stats = CollectionStats(sources_checked=len(self.sources))
        stats.source_distribution.update({source.name: 0 for source in self.sources})
        articles: list[ScrapedArticle] = []
        seen_reference_urls: set[str] = set()
        seen_reference_titles: set[str] = set()
        seen_article_urls: set[str] = set()
        seen_article_titles: set[str] = set()
        iterators = {source: source.discover().__aiter__() for source in self.sources}

        try:
            while iterators and len(articles) < limit:
                if should_cancel is not None and should_cancel():
                    break
                made_progress = False
                for source in list(iterators):
                    if should_cancel is not None and should_cancel():
                        break
                    if len(articles) >= limit:
                        break
                    if stats.articles_discovered >= self.maximum_articles_processed:
                        logger.warning("Maximum reference discovery budget reached")
                        iterators.clear()
                        break
                    if stats.articles_fetched >= self.maximum_articles_processed:
                        logger.warning("Maximum collection fetch budget reached")
                        iterators.clear()
                        break

                    try:
                        reference = await anext(iterators[source])
                    except StopAsyncIteration:
                        iterators.pop(source, None)
                        continue
                    except Exception as exc:
                        logger.exception("Collection source %s failed", source.name)
                        stats.source_errors[source.name] = self._safe_error(exc)
                        iterators.pop(source, None)
                        continue

                    made_progress = True
                    stats.articles_discovered += 1
                    reference_url = canonicalize_url(str(reference.url))
                    reference_title = title_fingerprint(reference.title)
                    if (
                        reference_url in seen_reference_urls
                        or reference_title in seen_reference_titles
                    ):
                        stats.duplicates += 1
                        continue
                    seen_reference_urls.add(reference_url)
                    seen_reference_titles.add(reference_title)

                    # Discovery metadata is cheap compared with downloading and
                    # sending a full article to the LLM. Advance through source
                    # listings until a title/summary has concrete incident
                    # signals, while retaining every downstream safety check.
                    if self.reference_filter is not None and not self.reference_filter(
                        reference
                    ):
                        stats.references_filtered += 1
                        continue

                    stats.articles_fetched += 1
                    try:
                        article = await source.fetch_article(reference)
                    except Exception as exc:
                        stats.article_errors += 1
                        logger.warning(
                            "Collection rejected an unreadable %s article: %s",
                            source.name,
                            self._safe_error(exc),
                        )
                        continue

                    canonical = canonicalize_url(str(article.url))
                    fingerprint = title_fingerprint(article.title)
                    if canonical in seen_article_urls or fingerprint in seen_article_titles:
                        stats.duplicates += 1
                        continue
                    seen_article_urls.add(canonical)
                    seen_article_titles.add(fingerprint)
                    articles.append(article)
                    stats.articles_collected = len(articles)
                    stats.source_distribution[article.source] += 1
                    logger.info(
                        "Article collected (%s/%s) from %s: %s",
                        len(articles),
                        limit,
                        article.source,
                        article.title,
                    )
                    if on_progress is not None:
                        on_progress(
                            {
                                "index": len(articles),
                                "total": limit,
                                "source": article.source,
                                "title": article.title,
                            }
                        )

                if not made_progress and iterators:
                    break
        finally:
            stats.execution_time = time.monotonic() - started

        return CollectionResult(articles=articles, stats=stats)

    @staticmethod
    def _safe_error(exc: Exception) -> str:
        return clean_text(str(exc))[:300] or exc.__class__.__name__


def save_articles_jsonl(articles: list[ScrapedArticle], path: Path) -> None:
    """Atomically write a local, reproducible article snapshot."""

    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.tmp")
    with temporary.open("w", encoding="utf-8") as output:
        for article in articles:
            payload = article.model_dump(mode="json")
            output.write(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
            output.write("\n")
    temporary.replace(path)


def load_articles_jsonl(path: Path, *, maximum: int = 100) -> list[ScrapedArticle]:
    if maximum < 1:
        raise ValueError("maximum must be positive")
    articles: list[ScrapedArticle] = []
    seen_urls: set[str] = set()
    seen_titles: set[str] = set()
    try:
        with path.open("r", encoding="utf-8") as source:
            for line_number, line in enumerate(source, start=1):
                if not line.strip():
                    continue
                if len(articles) >= maximum:
                    raise ValueError(
                        f"Dataset contains more than the supported {maximum} articles"
                    )
                try:
                    article = ScrapedArticle.model_validate_json(line)
                except ValidationError as exc:
                    raise ValueError(
                        f"Invalid ScrapedArticle on JSONL line {line_number}: {exc}"
                    ) from exc
                canonical = canonicalize_url(str(article.url))
                fingerprint = title_fingerprint(article.title)
                if canonical in seen_urls or fingerprint in seen_titles:
                    raise ValueError(
                        f"Duplicate article in dataset on JSONL line {line_number}"
                    )
                seen_urls.add(canonical)
                seen_titles.add(fingerprint)
                articles.append(article)
    except OSError as exc:
        raise ValueError(f"Could not read dataset {path}: {exc}") from exc
    if not articles:
        raise ValueError(f"Dataset contains no articles: {path}")
    return articles
