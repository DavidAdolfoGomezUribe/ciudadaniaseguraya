from datetime import UTC, datetime, timedelta

from src.classifiers.rule_based_classifier import RuleBasedClassifier
from src.extraction.locations import LocationExtractor
from src.models.article import ScrapedArticle
from src.services.candidate_selection import prioritize_articles


NOW = datetime(2026, 8, 31, 12, tzinfo=UTC)


def article(title: str, content: str, *, age_days: int) -> ScrapedArticle:
    return ScrapedArticle(
        source="Test News",
        title=title,
        url=f"https://example.com/{age_days}-{len(title)}",
        publication_date=NOW - timedelta(days=age_days),
        content=content,
    )


def test_prioritizes_concrete_recent_incident_and_excludes_stale_news() -> None:
    generic = article(
        "Consejos de seguridad para la ciudadanía",
        "La campaña ofrece recomendaciones generales para prevenir el delito.",
        age_days=1,
    )
    incident = article(
        "Comerciante fue víctima de robo en el barrio Restrepo",
        "El robo ocurrió en el barrio Restrepo y la víctima denunció el hecho.",
        age_days=2,
    )
    stale = article(
        "Un robo ocurrió en el barrio Centro",
        "El robo ocurrió en el barrio Centro y una persona fue víctima.",
        age_days=500,
    )

    result = prioritize_articles(
        [generic, stale, incident],
        classifier=RuleBasedClassifier(("robo", "hurto")),
        location_extractor=LocationExtractor(),
        maximum_age_days=365,
        now=NOW,
    )

    assert result.articles == [incident, generic]
    assert result.stale_articles == 1
