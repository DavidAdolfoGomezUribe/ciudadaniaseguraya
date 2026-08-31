import { FALLBACK_HEATMAP_SCALE } from "../constants/map.constants";

export function fallbackStyle(incidentCount) {
  const count = Math.max(0, Number(incidentCount) || 0);
  return (
    FALLBACK_HEATMAP_SCALE.find(
      ({ min, max }) => count >= min && (max === null || count <= max),
    ) || FALLBACK_HEATMAP_SCALE[0]
  );
}

export function hexagonColor(cell) {
  const fallback = fallbackStyle(cell.incidentCount);
  const color = /^#[\dA-F]{6}$/i.test(cell.color || "") ? cell.color : fallback.color;
  const numeric = Number.parseInt(color.slice(1), 16);
  return [
    (numeric >> 16) & 255,
    (numeric >> 8) & 255,
    numeric & 255,
    cell.incidentCount === 0 ? 120 : 185,
  ];
}

export function predominantType(incidentTypes = {}) {
  return (
    Object.entries(incidentTypes).sort((left, right) => right[1] - left[1])[0]?.[0] ||
    "Sin categoría predominante"
  );
}
