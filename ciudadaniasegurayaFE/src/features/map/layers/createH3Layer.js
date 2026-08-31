import { H3HexagonLayer } from "@deck.gl/geo-layers";

import { hexagonColor } from "../utils/hexagon-colors";

export function createH3Layer({
  cells,
  selectedH3Index,
  interactive,
  onHover,
  onClick,
}) {
  return new H3HexagonLayer({
    id: "incident-h3-layer",
    data: cells,
    getHexagon: (cell) => cell.h3Index,
    getFillColor: hexagonColor,
    getLineColor: (cell) =>
      cell.h3Index === selectedH3Index ? [244, 241, 231, 255] : [45, 45, 41, 150],
    getLineWidth: (cell) => (cell.h3Index === selectedH3Index ? 6 : 2),
    lineWidthUnits: "pixels",
    lineWidthMinPixels: 2,
    lineWidthMaxPixels: 6,
    pickable: interactive,
    filled: true,
    stroked: true,
    extruded: false,
    highPrecision: true,
    coverage: 1,
    // Conserva calles, carreras, avenidas y etiquetas legibles bajo la capa H3.
    opacity: 0.68,
    autoHighlight: interactive,
    highlightColor: [244, 241, 231, 110],
    onHover,
    onClick,
    updateTriggers: {
      getFillColor: cells,
      getHexagon: cells,
      getLineColor: selectedH3Index,
      getLineWidth: selectedH3Index,
    },
  });
}
