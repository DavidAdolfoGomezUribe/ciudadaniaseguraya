from functools import lru_cache
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

from pydantic import AliasChoices, Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from src.config.constants import BOGOTA_CITY_ID, CLASSIFIABLE_INCIDENT_TYPES


class Settings(BaseSettings):
    """Runtime configuration loaded from environment variables and `.env`."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        populate_by_name=True,
    )

    bogota_city_id: str = BOGOTA_CITY_ID
    scraper_user_agent: str = (
        "CiudadaniaSeguraYaAgent/0.1 "
        "(+https://ciudadaniaseguraya-fe.vercel.app/)"
    )
    request_timeout: float = Field(default=15.0, gt=0, le=60)
    source_request_delay: float = Field(default=1.0, ge=0.2, le=10)
    request_retries: int = Field(default=1, ge=0, le=3)

    default_result_limit: int = Field(
        default=5,
        ge=1,
        le=100,
        validation_alias=AliasChoices("DEFAULT_RESULT_LIMIT", "DEFAULT_SCRAPE_LIMIT"),
    )
    maximum_result_limit: int = Field(default=100, ge=1, le=100)
    max_collection_limit: int = Field(default=100, ge=1, le=100)
    bogota_max_pages: int = Field(default=40, ge=1, le=100)
    canal_feed_pages: int = Field(default=3, ge=1, le=10)
    maximum_articles_processed: int = Field(default=500, ge=5, le=2_000)
    article_max_age_days: int = Field(default=365, ge=1, le=3_650)
    allow_publication_date_fallback: bool = True
    enabled_sources: str = (
        "bogota_gov,canal_capital,el_espectador,noticias_rcn,noticias_caracol"
    )

    allowed_incident_types: str = ",".join(CLASSIFIABLE_INCIDENT_TYPES)

    nominatim_base_url: str = "https://nominatim.openstreetmap.org"
    nominatim_request_delay: float = Field(default=1.1, ge=1.0, le=30)
    geocoder_cache_path: Path = Path(".cache/nominatim.sqlite3")
    geocoder_cache_ttl_days: int = Field(default=30, ge=1, le=365)

    llm_provider: Literal["ollama", "openai"] = "ollama"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = ""
    openai_api_key: SecretStr | None = None
    openai_model: str = ""
    agent_timeout: float = Field(default=120.0, gt=0, le=600)
    agent_max_retries: int = Field(default=1, ge=0, le=1)
    provider_max_retries: int = Field(default=1, ge=0, le=3)
    agent_min_confidence: float = Field(default=0.65, ge=0, le=1)
    agent_max_content_chars: int = Field(default=30_000, ge=1_000, le=200_000)
    trajectories_path: Path = Path(".runs/trajectories")

    ai_ingest_url: str = ""
    ai_ingest_api_key: SecretStr | None = None
    ai_ingest_timeout: float = Field(default=20.0, gt=0, le=60)
    agent_control_api_key: SecretStr | None = None

    log_level: str = "INFO"

    @field_validator("bogota_city_id")
    @classmethod
    def valid_object_id(cls, value: str) -> str:
        normalized = value.strip().lower()
        if len(normalized) != 24 or any(c not in "0123456789abcdef" for c in normalized):
            raise ValueError("BOGOTA_CITY_ID must be a 24-character hexadecimal ObjectId")
        return normalized

    @field_validator("scraper_user_agent")
    @classmethod
    def identifiable_user_agent(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 10 or value.lower().startswith(("python", "httpx", "mozilla")):
            raise ValueError("SCRAPER_USER_AGENT must identify this application")
        return value

    @field_validator("maximum_result_limit", "max_collection_limit")
    @classmethod
    def iteration_two_limit(cls, value: int) -> int:
        if value > 100:
            raise ValueError("Iteration 2 supports at most 100 articles per run")
        return value

    @field_validator("ollama_base_url")
    @classmethod
    def valid_ollama_base_url(cls, value: str) -> str:
        normalized = value.strip().rstrip("/")
        if not normalized.startswith(("http://", "https://")):
            raise ValueError("OLLAMA_BASE_URL must use http or https")
        return normalized

    @field_validator("ai_ingest_url")
    @classmethod
    def valid_ai_ingest_url(cls, value: str) -> str:
        normalized = value.strip().rstrip("/")
        if not normalized:
            return normalized
        parsed = urlparse(normalized)
        local_hosts = {"backend", "localhost", "127.0.0.1", "::1"}
        if parsed.scheme != "https" and not (
            parsed.scheme == "http" and parsed.hostname in local_hosts
        ):
            raise ValueError(
                "AI_INGEST_URL must use HTTPS, except on the local Docker network"
            )
        return normalized

    @field_validator("agent_control_api_key")
    @classmethod
    def valid_control_api_key(
        cls, value: SecretStr | None
    ) -> SecretStr | None:
        if value is not None and len(value.get_secret_value()) < 32:
            raise ValueError("AGENT_CONTROL_API_KEY must contain at least 32 characters")
        return value

    @model_validator(mode="after")
    def coherent_limits(self) -> "Settings":
        if self.default_result_limit > self.maximum_result_limit:
            raise ValueError(
                "DEFAULT_RESULT_LIMIT cannot exceed MAXIMUM_RESULT_LIMIT"
            )
        if self.default_result_limit > self.max_collection_limit:
            raise ValueError(
                "DEFAULT_RESULT_LIMIT cannot exceed MAX_COLLECTION_LIMIT"
            )
        return self

    @property
    def incident_types(self) -> tuple[str, ...]:
        configured = tuple(
            item.strip() for item in self.allowed_incident_types.split(",") if item.strip()
        )
        invalid = set(configured) - set(CLASSIFIABLE_INCIDENT_TYPES)
        if invalid:
            raise ValueError(f"Unsupported deterministic incident types: {sorted(invalid)}")
        return configured

    @property
    def source_names(self) -> tuple[str, ...]:
        supported = {
            "bogota_gov",
            "canal_capital",
            "el_espectador",
            "noticias_rcn",
            "noticias_caracol",
        }
        configured = tuple(
            dict.fromkeys(
                item.strip().casefold()
                for item in self.enabled_sources.split(",")
                if item.strip()
            )
        )
        invalid = set(configured) - supported
        if invalid:
            raise ValueError(f"Unsupported news sources: {sorted(invalid)}")
        if not configured:
            raise ValueError("At least one news source must be enabled")
        return configured

    @property
    def default_scrape_limit(self) -> int:
        """Backward-compatible name used by Iteration 1 callers."""

        return self.default_result_limit


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
