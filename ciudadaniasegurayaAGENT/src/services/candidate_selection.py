from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from src.classifiers.rule_based_classifier import RuleBasedClassifier
from src.extraction.locations import LocationExtractor
from src.models.article import ScrapedArticle


@dataclass(frozen=True, slots=True)
class CandidateSelection:
    articles: list[ScrapedArticle]
    stale_articles: int


def prioritize_articles(
    articles: list[ScrapedArticle],
    *,
    classifier: RuleBasedClassifier,
    location_extractor: LocationExtractor,
    maximum_age_days: int,
    now: datetime | None = None,
) -> CandidateSelection:
    """Filter stale records and put likely concrete incidents first.

    This is only an ordering heuristic. Every retained article still passes
    through the LLM draft, deterministic evidence verification, geocoding and
    boundary checks before it can become a candidate.
    """

    reference_time = now or datetime.now(UTC)
    cutoff = reference_time - timedelta(days=maximum_age_days)
    eligible: list[tuple[int, ScrapedArticle]] = []
    stale_articles = 0
    for index, article in enumerate(articles):
        publication = article.publication_date
        if publication is not None and publication.astimezone(UTC) < cutoff:
            stale_articles += 1
            continue
        eligible.append((index, article))

    def score(item: tuple[int, ScrapedArticle]) -> tuple[int, float, int]:
        index, article = item
        points = 0
        if classifier.might_be_incident(article.title, article.description):
            points += 8
        if classifier.classify(
            article.title,
            article.description or "",
            article.content,
        ) is not None:
            points += 8
        location_material = "\n".join(
            value
            for value in (article.title, article.description or "", article.content)
            if value
        )
        if location_extractor.extract(location_material) is not None:
            points += 4
        timestamp = (
            article.publication_date.astimezone(UTC).timestamp()
            if article.publication_date is not None
            else float("-inf")
        )
        return points, timestamp, -index

    eligible.sort(key=score, reverse=True)
    return CandidateSelection(
        articles=[article for _, article in eligible],
        stale_articles=stale_articles,
    )
