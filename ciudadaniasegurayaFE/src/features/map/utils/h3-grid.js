import { cellToLatLng, getResolution, polygonToCells } from "h3-js";

function polygonsFromGeometry(geometry) {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates];
  if (geometry.type === "MultiPolygon") return geometry.coordinates;
  return [];
}

function pointInRing([longitude, latitude], ring) {
  let inside = false;
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index++
  ) {
    const [xi, yi] = ring[index];
    const [xj, yj] = ring[previous];
    const intersects =
      yi > latitude !== yj > latitude &&
      longitude < ((xj - xi) * (latitude - yi)) / (yj - yi || 1e-12) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInsideGeometry(point, geometry) {
  const polygons = polygonsFromGeometry(geometry);
  if (!polygons.length) return true;

  return polygons.some(([outerRing, ...holes]) => {
    if (!outerRing || !pointInRing(point, outerRing)) return false;
    return holes.every((hole) => !pointInRing(point, hole));
  });
}

function viewportPolygon(bounds) {
  return [
    [
      [bounds.west, bounds.south],
      [bounds.east, bounds.south],
      [bounds.east, bounds.north],
      [bounds.west, bounds.north],
      [bounds.west, bounds.south],
    ],
  ];
}

function resolutionCandidates(requestedResolution, supportedResolutions) {
  const supported = [...new Set(supportedResolutions)]
    .filter(Number.isInteger)
    .sort((left, right) => right - left);
  const atOrBelowRequested = supported.filter(
    (resolution) => resolution <= requestedResolution,
  );

  return atOrBelowRequested.length ? atOrBelowRequested : supported.slice(-1);
}

export function generateH3Grid({
  bounds,
  requestedResolution,
  supportedResolutions,
  boundary,
  maxCells,
}) {
  const candidates = resolutionCandidates(requestedResolution, supportedResolutions);

  if (!candidates.length) {
    throw new Error("No existen resoluciones H3 habilitadas");
  }

  for (const resolution of candidates) {
    const indexes = polygonToCells(viewportPolygon(bounds), resolution, true).filter(
      (h3Index) => {
        const [latitude, longitude] = cellToLatLng(h3Index);
        return pointInsideGeometry([longitude, latitude], boundary);
      },
    );

    if (indexes.length <= maxCells) {
      return {
        indexes,
        resolution,
        resolutionAdjusted: resolution !== requestedResolution,
      };
    }
  }

  const minimumResolution = candidates.at(-1);
  throw new Error(
    `La vista supera ${maxCells.toLocaleString("es-CO")} celdas incluso en H3 ${minimumResolution}; acércate al mapa`,
  );
}

export function allCellsUseResolution(indexes, resolution) {
  return indexes.every((index) => getResolution(index) === resolution);
}
