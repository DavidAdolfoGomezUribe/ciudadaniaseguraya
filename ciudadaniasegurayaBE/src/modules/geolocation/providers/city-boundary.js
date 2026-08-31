function pointInRing([longitude, latitude], ring) {
  let inside = false;

  for (let current = 0, previous = ring.length - 1; current < ring.length; previous = current++) {
    const [currentLongitude, currentLatitude] = ring[current];
    const [previousLongitude, previousLatitude] = ring[previous];
    const crosses =
      currentLatitude > latitude !== previousLatitude > latitude &&
      longitude <
        ((previousLongitude - currentLongitude) *
          (latitude - currentLatitude)) /
          (previousLatitude - currentLatitude) +
          currentLongitude;

    if (crosses) {
      inside = !inside;
    }
  }

  return inside;
}

function pointInPolygon(point, polygon) {
  if (!pointInRing(point, polygon[0])) {
    return false;
  }

  return !polygon.slice(1).some((hole) => pointInRing(point, hole));
}

export function pointBelongsToBoundary(point, boundary) {
  if (!boundary) {
    return false;
  }

  if (boundary.type === "Polygon") {
    return pointInPolygon(point.coordinates, boundary.coordinates);
  }

  if (boundary.type === "MultiPolygon") {
    return boundary.coordinates.some((polygon) =>
      pointInPolygon(point.coordinates, polygon),
    );
  }

  return false;
}
