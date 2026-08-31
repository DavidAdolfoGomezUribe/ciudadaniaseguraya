export const COLOMBIA_BOUNDS = Object.freeze([
  [-79.2, -4.6],
  [-66.5, 13.7],
]);

export const DEFAULT_H3_SUPPORTED_RESOLUTIONS = Object.freeze([4, 5, 6, 7, 8, 9]);

export const BOGOTA_VIEWPORT = Object.freeze({
  longitude: -74.0721,
  latitude: 4.711,
  zoom: 11,
  bearing: 0,
  pitch: 0,
});

// Alias conservado para consumidores que todavía importan el nombre anterior.
export const COLOMBIA_VIEWPORT = BOGOTA_VIEWPORT;

export const FALLBACK_HEATMAP_SCALE = Object.freeze([
  {
    level: 0,
    min: 0,
    max: 0,
    color: "#2563EB",
    label: "Sin registros validados",
  },
  { level: 1, min: 1, max: 2, color: "#22C55E", label: "Nivel 1" },
  { level: 2, min: 3, max: 5, color: "#EAB308", label: "Nivel 2" },
  { level: 3, min: 6, max: 9, color: "#F97316", label: "Nivel 3" },
  { level: 4, min: 10, max: 19, color: "#EF4444", label: "Nivel 4" },
  { level: 5, min: 20, max: null, color: "#111827", label: "Nivel 5" },
]);

export const INITIAL_BOUNDS = Object.freeze({
  west: -74.25,
  south: 4.45,
  east: -73.85,
  north: 4.9,
});

export const MAP_MOVE_DEBOUNCE_MS = 400;
