import { describe, expect, it } from "vitest";

import { resolutionByZoom } from "./resolution-by-zoom";

describe("resolutionByZoom", () => {
  it.each([
    [4.5, 4],
    [5.99, 4],
    [6, 5],
    [7.99, 5],
    [8, 6],
    [9.99, 6],
    [10, 7],
    [11.99, 7],
    [12, 8],
    [13.99, 8],
    [14, 9],
    [17, 9],
  ])("convierte zoom %s a resolucion %s", (zoom, resolution) => {
    expect(resolutionByZoom(zoom)).toBe(resolution);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, undefined, "8"])(
    "usa resolucion nacional para un zoom no numerico: %s",
    (zoom) => {
      expect(resolutionByZoom(zoom)).toBe(4);
    },
  );
});
