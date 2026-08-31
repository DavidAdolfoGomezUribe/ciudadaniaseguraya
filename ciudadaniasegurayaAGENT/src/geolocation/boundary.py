"""Bogotá boundary checks aligned with the existing backend seed."""

from src.config.constants import BOGOTA_BOUNDARY_RINGS


def _point_in_ring(
    longitude: float,
    latitude: float,
    ring: tuple[tuple[float, float], ...],
) -> bool:
    inside = False
    previous = len(ring) - 1
    for current in range(len(ring)):
        current_longitude, current_latitude = ring[current]
        previous_longitude, previous_latitude = ring[previous]
        crosses = (current_latitude > latitude) != (previous_latitude > latitude)
        if crosses:
            boundary_longitude = (
                (previous_longitude - current_longitude)
                * (latitude - current_latitude)
                / (previous_latitude - current_latitude)
                + current_longitude
            )
            if longitude < boundary_longitude:
                inside = not inside
        previous = current
    return inside


def point_inside_bogota(latitude: float, longitude: float) -> bool:
    """Return whether a point belongs to the seeded Bogotá MultiPolygon."""

    return any(
        _point_in_ring(longitude, latitude, ring)
        for ring in BOGOTA_BOUNDARY_RINGS
    )


__all__ = ["point_inside_bogota"]
