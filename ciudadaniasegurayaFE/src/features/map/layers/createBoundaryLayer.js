import { GeoJsonLayer } from "@deck.gl/layers";

export function createBoundaryLayer(boundary) {
  return new GeoJsonLayer({
    id: "coverage-boundary",
    data: boundary,
    filled: true,
    stroked: true,
    pickable: false,
    getFillColor: [56, 56, 50, 8],
    getLineColor: [56, 56, 50, 190],
    getLineWidth: 2,
    lineWidthMinPixels: 1,
  });
}
