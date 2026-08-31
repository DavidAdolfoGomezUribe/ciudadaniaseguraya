const NETWORK_PRECISION = 4;

function round(value, precision) {
  return Number(Number(value).toFixed(precision));
}

export function normalizeBounds(
  bounds,
  paddingRatio = 0.12,
  precision = NETWORK_PRECISION,
) {
  const width = Math.max(0, bounds.east - bounds.west);
  const height = Math.max(0, bounds.north - bounds.south);
  const horizontalPadding = width * paddingRatio;
  const verticalPadding = height * paddingRatio;

  return {
    north: round(Math.min(13.7, bounds.north + verticalPadding), precision),
    south: round(Math.max(-4.6, bounds.south - verticalPadding), precision),
    east: round(Math.min(-66.5, bounds.east + horizontalPadding), precision),
    west: round(Math.max(-79.2, bounds.west - horizontalPadding), precision),
  };
}

export function viewportKey(bounds) {
  const normalized = normalizeBounds(bounds);
  return [normalized.west, normalized.south, normalized.east, normalized.north].join(
    ":",
  );
}

export function intersectsColombia(bounds) {
  return !(
    bounds.east < -79.2 ||
    bounds.west > -66.5 ||
    bounds.north < -4.6 ||
    bounds.south > 13.7
  );
}
