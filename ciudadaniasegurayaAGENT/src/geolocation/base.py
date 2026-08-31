from abc import ABC, abstractmethod
from dataclasses import dataclass

from src.extraction.locations import LocationExtraction


class GeocodingError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class GeocodeResult:
    latitude: float
    longitude: float
    display_name: str
    matched_query: str
    provider: str = "Nominatim / OpenStreetMap"


class Geocoder(ABC):
    @abstractmethod
    async def geocode(self, location: LocationExtraction) -> GeocodeResult | None:
        """Return a coherent Bogotá match, or None when it cannot be verified."""

    async def aclose(self) -> None:
        """Release provider resources."""
