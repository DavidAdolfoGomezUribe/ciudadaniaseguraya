import { describe, expect, it } from "vitest";

import { BOGOTA_VIEWPORT, INITIAL_BOUNDS } from "../constants/map.constants";
import { ROLLING_YEAR_PERIOD } from "../utils/rolling-year";
import { useMapUiStore } from "./map-ui.store";

describe("estado del viewport", () => {
  it("entrega una copia extensible a DeckGL aunque la constante esté congelada", () => {
    useMapUiStore.getState().setViewport(BOGOTA_VIEWPORT);
    const viewport = useMapUiStore.getState().viewport;

    expect(viewport).not.toBe(BOGOTA_VIEWPORT);
    expect(Object.isExtensible(viewport)).toBe(true);
    expect(() => {
      viewport.padding = { top: 0, right: 0, bottom: 0, left: 0 };
    }).not.toThrow();
  });

  it("inicia enfocado en Bogotá y con alcance anual móvil", () => {
    useMapUiStore.setState({
      viewport: { ...BOGOTA_VIEWPORT },
      period: ROLLING_YEAR_PERIOD,
    });

    expect(useMapUiStore.getState()).toMatchObject({
      viewport: {
        latitude: 4.711,
        longitude: -74.0721,
        zoom: 11,
      },
      period: "rolling-year",
    });
  });

  it("restablece cámara, bounds y resolución sin perder la selección compartida", () => {
    useMapUiStore.setState({
      viewport: {
        longitude: -70,
        latitude: 8,
        zoom: 5,
        bearing: 0,
        pitch: 0,
      },
      committedBounds: {
        west: -71,
        south: 7,
        east: -69,
        north: 9,
      },
      requestedResolution: 4,
      resolution: 4,
      resolutionAdjusted: true,
      selectedH3Index: "84754a9ffffffff",
    });

    useMapUiStore.getState().resetViewport();

    expect(useMapUiStore.getState()).toMatchObject({
      viewport: BOGOTA_VIEWPORT,
      committedBounds: INITIAL_BOUNDS,
      requestedResolution: 7,
      resolution: 7,
      resolutionAdjusted: false,
      selectedH3Index: "84754a9ffffffff",
    });
  });

  it("no pierde la resolución efectiva al mover la cámara sin cruzar umbral", () => {
    useMapUiStore.setState({
      requestedResolution: 8,
      resolution: 7,
      resolutionAdjusted: true,
    });

    useMapUiStore.getState().setViewport({
      ...BOGOTA_VIEWPORT,
      zoom: 12.5,
      longitude: -74.08,
    });

    expect(useMapUiStore.getState()).toMatchObject({
      requestedResolution: 8,
      resolution: 7,
      resolutionAdjusted: true,
    });
  });
});
