export const HEATMAP_SCALE = Object.freeze([
  { min: 0, max: 0, level: 0, color: "#2563EB", name: "Azul" },
  { min: 1, max: 2, level: 1, color: "#22C55E", name: "Verde" },
  { min: 3, max: 5, level: 2, color: "#EAB308", name: "Amarillo" },
  { min: 6, max: 9, level: 3, color: "#F97316", name: "Naranja" },
  { min: 10, max: 19, level: 4, color: "#EF4444", name: "Rojo" },
  {
    min: 20,
    max: Number.POSITIVE_INFINITY,
    level: 5,
    color: "#111827",
    name: "Negro",
  },
]);

export function heatmapStyle(incidentCount) {
  return (
    HEATMAP_SCALE.find(
      ({ min, max }) => incidentCount >= min && incidentCount <= max,
    ) ?? HEATMAP_SCALE[0]
  );
}
