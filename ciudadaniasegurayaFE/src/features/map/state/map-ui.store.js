import { create } from "zustand";

import { BOGOTA_VIEWPORT, INITIAL_BOUNDS } from "../constants/map.constants";
import { resolutionByZoom } from "../utils/resolution-by-zoom";
import { ROLLING_YEAR_PERIOD } from "../utils/rolling-year";

export const useMapUiStore = create((set) => ({
  activated: false,
  viewport: { ...BOGOTA_VIEWPORT },
  committedBounds: INITIAL_BOUNDS,
  requestedResolution: resolutionByZoom(BOGOTA_VIEWPORT.zoom),
  resolution: resolutionByZoom(BOGOTA_VIEWPORT.zoom),
  resolutionAdjusted: false,
  selectedH3Index: null,
  hoveredCell: null,
  visibleH3Indexes: new Set(),
  period: ROLLING_YEAR_PERIOD,
  incidentType: "",
  activeCityId: "",
  activeCityName: "Cobertura disponible",
  gridStatus: "idle",
  gridError: null,
  activate: () => set({ activated: true }),
  deactivate: () => set({ activated: false, hoveredCell: null }),
  setViewport: (viewport) =>
    set((state) => {
      const requestedResolution = resolutionByZoom(viewport.zoom);
      const resolutionChanged = requestedResolution !== state.requestedResolution;
      return {
        viewport: { ...viewport },
        requestedResolution,
        resolution: resolutionChanged ? requestedResolution : state.resolution,
        resolutionAdjusted: resolutionChanged ? false : state.resolutionAdjusted,
      };
    }),
  resetViewport: () =>
    set({
      viewport: { ...BOGOTA_VIEWPORT },
      committedBounds: { ...INITIAL_BOUNDS },
      requestedResolution: resolutionByZoom(BOGOTA_VIEWPORT.zoom),
      resolution: resolutionByZoom(BOGOTA_VIEWPORT.zoom),
      resolutionAdjusted: false,
      hoveredCell: null,
    }),
  commitBounds: (committedBounds) => set({ committedBounds }),
  setGrid({ indexes, resolution, resolutionAdjusted }) {
    set({
      visibleH3Indexes: new Set(indexes),
      resolution,
      resolutionAdjusted,
      gridStatus: "ready",
      gridError: null,
    });
  },
  setGridStatus: (gridStatus, gridError = null) => set({ gridStatus, gridError }),
  selectH3: (selectedH3Index) => set({ selectedH3Index }),
  hoverCell: (hoveredCell) => set({ hoveredCell }),
  setIncidentType: (incidentType) => set({ incidentType }),
  setActiveCity: (activeCityId, activeCityName) =>
    set({ activeCityId, activeCityName }),
}));
