import { describe, expect, it } from "vitest";

import { COLOMBIA_BOUNDS } from "../constants/map.constants";
import { mapControllerOptions } from "./map-controller-options";

describe("cámara compartida del mapa", () => {
  it("aplica a DeckGL los mismos límites geográficos y de zoom", () => {
    expect(
      mapControllerOptions({
        activated: true,
        minZoom: 4.5,
        maxZoom: 17,
      }),
    ).toEqual({
      minZoom: 4.5,
      maxZoom: 17,
      maxBounds: COLOMBIA_BOUNDS,
      dragRotate: false,
      touchRotate: false,
    });
  });

  it("deshabilita la cámara mientras el mapa está bloqueado", () => {
    expect(
      mapControllerOptions({
        activated: false,
        minZoom: 4.5,
        maxZoom: 17,
      }),
    ).toBe(false);
  });
});
