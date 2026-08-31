import { COLOMBIA_BOUNDS } from "../constants/map.constants";

export function mapControllerOptions({ activated, minZoom, maxZoom }) {
  if (!activated) return false;

  return {
    minZoom,
    maxZoom,
    maxBounds: COLOMBIA_BOUNDS,
    dragRotate: false,
    touchRotate: false,
  };
}
