from datetime import datetime

import pytest

from src.classifiers.rule_based_classifier import RuleBasedClassifier
from src.config.settings import Settings
from src.extraction.dates import IncidentDateExtractor
from src.extraction.locations import LocationExtractor
from src.geolocation.base import GeocodeResult, Geocoder
from src.models.article import ArticleReference, ScrapedArticle
from src.services.news_pipeline import (
    DUPLICATE,
    INSUFFICIENT_LOCATION,
    NO_INCIDENT_DATE,
    NewsPipeline,
)


class FakeClient:
    async def aclose(self) -> None:
        pass


class FakeGeocoder(Geocoder):
    async def geocode(self, location):
        return GeocodeResult(
            latitude=4.586,
            longitude=-74.101,
            display_name="Restrepo, Antonio Nariño, Bogotá, Colombia",
            matched_query=location.address,
        )


class FakeSource:
    name = "Fuente de prueba"

    def __init__(self, references: list[ArticleReference]):
        self.references = references

    async def discover(self):
        for reference in self.references:
            yield reference

    async def fetch_article(self, reference: ArticleReference) -> ScrapedArticle:
        return ScrapedArticle(
            source=self.name,
            title=reference.title,
            url=reference.url,
            publication_date=reference.publication_date,
            description=(
                "La fuente confirmó que un comerciante fue víctima de robo "
                "en el barrio Restrepo."
            ),
            content=(
                "El robo ocurrió el 20 de agosto de 2026 a las 8:30 p. m. "
                "en el barrio Restrepo, en la localidad de Antonio Nariño. "
                "La Policía atendió el caso en la Carrera 20 con Calle 15."
            ),
        )


class BrokenSource:
    name = "Fuente caída"

    async def discover(self):
        if False:
            yield None
        raise RuntimeError("HTML temporalmente no disponible")


def pipeline(sources) -> NewsPipeline:
    return NewsPipeline(
        settings=Settings(maximum_articles_processed=20),
        client=FakeClient(),
        sources=sources,
        classifier=RuleBasedClassifier(("robo", "hurto")),
        date_extractor=IncidentDateExtractor(),
        location_extractor=LocationExtractor(),
        geocoder=FakeGeocoder(),
    )


def article_with(content: str, *, publication_date: datetime | None) -> ScrapedArticle:
    return ScrapedArticle(
        source="Fuente de prueba",
        title="Comerciante fue víctima de robo en el barrio Restrepo",
        url="https://example.com/noticia",
        publication_date=publication_date,
        description="La fuente reportó un robo concreto en Bogotá.",
        content=content,
    )


@pytest.mark.asyncio
async def test_pipeline_deduplicates_by_normalized_title() -> None:
    first = ArticleReference(
        source="Fuente de prueba",
        title="Comerciante fue víctima de robo en el barrio Restrepo",
        url="https://example.com/noticia-1",
        publication_date=datetime.fromisoformat("2026-08-21T10:00:00-05:00"),
    )
    duplicate_title = ArticleReference(
        source="Fuente de prueba",
        title="  COMERCIANTE fue victima de ROBO en el barrio Restrepo!!! ",
        url="https://example.com/noticia-2",
        publication_date=datetime.fromisoformat("2026-08-21T10:00:00-05:00"),
    )

    result = await pipeline([FakeSource([first, duplicate_title])]).run(limit=2)

    assert len(result.incidents) == 1
    assert result.stats.rejected_reasons[DUPLICATE] == 1


@pytest.mark.asyncio
async def test_source_failure_does_not_stop_other_source() -> None:
    reference = ArticleReference(
        source="Fuente de prueba",
        title="Comerciante fue víctima de robo en el barrio Restrepo",
        url="https://example.com/noticia-1",
        publication_date=datetime.fromisoformat("2026-08-21T10:00:00-05:00"),
    )

    result = await pipeline([BrokenSource(), FakeSource([reference])]).run(limit=1)

    assert len(result.incidents) == 1
    assert "20 de agosto de 2026" in result.incidents[0].description
    assert "Fuente caída" in result.stats.source_errors


def test_publication_date_is_an_explicit_fallback_for_a_linked_event() -> None:
    publication = datetime.fromisoformat("2026-08-21T16:15:00+00:00")
    article = article_with(
        "El robo ocurrió en el barrio Restrepo, en la localidad de Antonio Nariño.",
        publication_date=publication,
    )

    event, reason = pipeline([])._extract_event_evidence(
        article,
        required_type="robo",
    )

    assert reason == ""
    assert event is not None
    assert event.date.basis == "publication_fallback"
    assert event.date.value.isoformat() == "2026-08-21T11:15:00-05:00"
    assert "Fecha de publicación" in event.date.evidence
    assert event.location.neighborhood == "Restrepo"


def test_publication_fallback_can_be_disabled() -> None:
    publication = datetime.fromisoformat("2026-08-21T16:15:00+00:00")
    article = article_with(
        "El robo ocurrió en el barrio Restrepo, en la localidad de Antonio Nariño.",
        publication_date=publication,
    )
    instance = pipeline([])
    instance.settings.allow_publication_date_fallback = False

    event, reason = instance._extract_event_evidence(article, required_type="robo")

    assert event is None
    assert reason == NO_INCIDENT_DATE


def test_explicit_incident_datetime_has_priority_over_publication() -> None:
    publication = datetime.fromisoformat("2026-08-21T16:15:00+00:00")
    article = article_with(
        "El robo ocurrió el 20 de agosto de 2026 a las 8:30 p. m. "
        "en el barrio Restrepo, en la localidad de Antonio Nariño.",
        publication_date=publication,
    )

    event, reason = pipeline([])._extract_event_evidence(
        article,
        required_type="robo",
    )

    assert reason == ""
    assert event is not None
    assert event.date.basis == "incident_text"
    assert event.date.value.isoformat() == "2026-08-20T20:30:00-05:00"


def test_does_not_mix_datetime_and_location_from_different_incidents() -> None:
    article = article_with(
        "El robo ocurrió el 20 de agosto de 2026 a las 8:30 p. m.\n"
        "El hurto ocurrió en el barrio Restrepo, en la localidad de Antonio Nariño.",
        publication_date=datetime.fromisoformat("2026-08-21T16:15:00+00:00"),
    )

    event, reason = pipeline([])._extract_event_evidence(
        article,
        required_type="robo",
    )

    assert event is None
    assert reason == INSUFFICIENT_LOCATION


def test_title_locality_disambiguates_the_event_neighborhood() -> None:
    article = ScrapedArticle(
        source="Fuente de prueba",
        title="Capturado cuando robaba a una mujer en Barrios Unidos",
        url="https://example.com/noticia-localidad",
        publication_date=datetime.fromisoformat("2026-08-21T16:15:00+00:00"),
        description="La fuente reportó un robo concreto en Bogotá.",
        content=(
            "Estos hechos ocurrieron en el barrio San Miguel, donde un hombre "
            "robó el celular de una mujer."
        ),
    )

    event, reason = pipeline([])._extract_event_evidence(
        article,
        required_type="robo",
    )

    assert reason == ""
    assert event is not None
    assert event.location.locality == "Barrios Unidos"
    assert "en Barrios Unidos (título)" in event.location.evidence
