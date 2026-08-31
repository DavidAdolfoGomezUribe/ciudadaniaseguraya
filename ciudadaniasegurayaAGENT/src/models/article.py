from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


class ArticleReference(BaseModel):
    """A lightweight discovery result which may already include RSS content."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    source: str = Field(min_length=2, max_length=80)
    title: str = Field(min_length=1, max_length=500)
    url: HttpUrl
    publication_date: datetime | None = None
    description: str | None = Field(default=None, max_length=2_000)
    content_html: str | None = None
    title_is_derived: bool = False

    @field_validator("publication_date")
    @classmethod
    def publication_date_has_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.utcoffset() is None:
            raise ValueError("publication_date must include a timezone")
        return value


class ScrapedArticle(BaseModel):
    """Normalized source material, before incident interpretation."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    source: str = Field(min_length=2, max_length=80)
    title: str = Field(min_length=1, max_length=500)
    url: HttpUrl
    publication_date: datetime | None = None
    description: str | None = Field(default=None, max_length=2_000)
    content: str = Field(min_length=20)
    extracted_location_text: str | None = None

    @field_validator("publication_date")
    @classmethod
    def publication_date_has_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.utcoffset() is None:
            raise ValueError("publication_date must include a timezone")
        return value
