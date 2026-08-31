from __future__ import annotations

from typing import Literal, cast

from src.agents.incident_analysis_agent import IncidentAnalysisAgent
from src.agents.verifier import AgentDraftVerifier
from src.classifiers.rule_based_classifier import RuleBasedClassifier
from src.config.settings import Settings
from src.extraction.dates import IncidentDateExtractor
from src.extraction.locations import LocationExtractor
from src.geolocation.nominatim import NominatimGeocoder
from src.integrations.backend import BackendIncidentClient
from src.llm.base import LLMProvider
from src.llm.ollama import OllamaProvider
from src.llm.openai import OpenAIProvider
from src.models.article import ScrapedArticle
from src.scrapers.http import RespectfulHttpClient
from src.services.agent_pipeline import AgentPipeline
from src.services.collection_service import CollectionService
from src.services.news_pipeline import NewsPipeline
from src.sources.base import BaseNewsSource
from src.sources.bogota_gov import BogotaGovSource
from src.sources.canal_capital import CanalCapitalSource
from src.sources.el_espectador import ElEspectadorSource
from src.sources.noticias_caracol import NoticiasCaracolSource
from src.sources.noticias_rcn import NoticiasRCNSource
from src.sources.snapshot import SnapshotNewsSource


def build_http_client(settings: Settings) -> RespectfulHttpClient:
    return RespectfulHttpClient(
        user_agent=settings.scraper_user_agent,
        timeout=settings.request_timeout,
        request_delay=settings.source_request_delay,
        retries=settings.request_retries,
    )


def build_geocoder(settings: Settings) -> NominatimGeocoder:
    return NominatimGeocoder(
        base_url=settings.nominatim_base_url,
        user_agent=settings.scraper_user_agent,
        timeout=settings.request_timeout,
        request_delay=settings.nominatim_request_delay,
        cache_path=settings.geocoder_cache_path,
        cache_ttl_days=settings.geocoder_cache_ttl_days,
    )


def build_sources(
    settings: Settings,
    client: RespectfulHttpClient,
) -> list[BaseNewsSource]:
    factories = {
        "bogota_gov": lambda: BogotaGovSource(
            client, max_pages=settings.bogota_max_pages
        ),
        "canal_capital": lambda: CanalCapitalSource(
            client, feed_pages=settings.canal_feed_pages
        ),
        "el_espectador": lambda: ElEspectadorSource(client),
        "noticias_rcn": lambda: NoticiasRCNSource(client),
        "noticias_caracol": lambda: NoticiasCaracolSource(client),
    }
    return [cast(BaseNewsSource, factories[name]()) for name in settings.source_names]


def build_baseline_pipeline(
    settings: Settings,
    *,
    articles: list[ScrapedArticle] | None = None,
) -> NewsPipeline:
    client = build_http_client(settings)
    sources = (
        [cast(BaseNewsSource, SnapshotNewsSource(articles))]
        if articles is not None
        else build_sources(settings, client)
    )
    return NewsPipeline(
        settings=settings,
        client=client,
        sources=sources,
        classifier=RuleBasedClassifier(settings.incident_types),
        date_extractor=IncidentDateExtractor(),
        location_extractor=LocationExtractor(),
        geocoder=build_geocoder(settings),
    )


def build_pipeline(settings: Settings) -> NewsPipeline:
    """Backward-compatible Iteration 1 factory name."""

    return build_baseline_pipeline(settings)


def build_collection_service(settings: Settings) -> CollectionService:
    client = build_http_client(settings)
    classifier = RuleBasedClassifier(settings.incident_types)
    return CollectionService(
        client=client,
        sources=build_sources(settings, client),
        max_collection_limit=settings.max_collection_limit,
        maximum_articles_processed=settings.maximum_articles_processed,
        reference_filter=lambda reference: classifier.might_be_incident(
            reference.title,
            reference.description,
        ),
    )


def build_llm_provider(
    settings: Settings,
    provider: Literal["ollama", "openai"] | None = None,
) -> LLMProvider:
    selected = provider or settings.llm_provider
    if selected == "ollama":
        return OllamaProvider(
            base_url=settings.ollama_base_url,
            model=settings.ollama_model,
            timeout=settings.agent_timeout,
            max_retries=settings.provider_max_retries,
        )
    if selected == "openai":
        return OpenAIProvider(
            api_key=settings.openai_api_key,
            model=settings.openai_model,
            timeout=settings.agent_timeout,
            max_retries=settings.provider_max_retries,
        )
    raise ValueError(f"Unsupported LLM provider: {selected}")


def build_backend_incident_client(settings: Settings) -> BackendIncidentClient:
    return BackendIncidentClient(
        url=settings.ai_ingest_url,
        api_key=settings.ai_ingest_api_key,
        timeout=settings.ai_ingest_timeout,
    )


def build_agent_pipeline(
    settings: Settings,
    *,
    provider: Literal["ollama", "openai"] | None = None,
) -> AgentPipeline:
    llm_provider = build_llm_provider(settings, provider)
    verifier = AgentDraftVerifier(
        classifier=RuleBasedClassifier(settings.incident_types),
        date_extractor=IncidentDateExtractor(),
        location_extractor=LocationExtractor(),
        minimum_confidence=settings.agent_min_confidence,
        allow_publication_date_fallback=settings.allow_publication_date_fallback,
    )
    return AgentPipeline(
        settings=settings,
        agent=IncidentAnalysisAgent(
            provider=llm_provider,
            maximum_content_chars=settings.agent_max_content_chars,
        ),
        verifier=verifier,
        geocoder=build_geocoder(settings),
    )
