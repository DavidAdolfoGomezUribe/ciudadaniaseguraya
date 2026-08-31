import { getResolution } from "h3-js";
import { describe, expect, it } from "vitest";

import { allCellsUseResolution, generateH3Grid } from "./h3-grid";

const colombiaRectangle = {
  type: "Polygon",
  coordinates: [
    [
      [-79.2, -4.6],
      [-66.5, -4.6],
      [-66.5, 13.7],
      [-79.2, 13.7],
      [-79.2, -4.6],
    ],
  ],
};

describe("generación visible H3", () => {
  it("genera la vista nacional con celdas grandes de resolución 4", () => {
    const result = generateH3Grid({
      bounds: {
        west: -79.2,
        south: -4.6,
        east: -66.5,
        north: 13.7,
      },
      requestedResolution: 4,
      supportedResolutions: [4, 5, 6, 7, 8, 9],
      boundary: colombiaRectangle,
      maxCells: 12_000,
    });

    expect(result.indexes.length).toBeGreaterThan(0);
    expect(result.indexes.length).toBeLessThanOrEqual(12_000);
    expect(result.resolution).toBe(4);
    expect(result.resolutionAdjusted).toBe(false);
    expect(allCellsUseResolution(result.indexes, 4)).toBe(true);
  });

  it("reduce únicamente a una resolución soportada sin truncar la cuadrícula", () => {
    const result = generateH3Grid({
      bounds: {
        west: -74.2,
        south: 4.5,
        east: -73.9,
        north: 4.8,
      },
      requestedResolution: 9,
      supportedResolutions: [4, 5, 6, 7, 8, 9],
      boundary: colombiaRectangle,
      maxCells: 100,
    });

    expect([4, 5, 6, 7, 8, 9]).toContain(result.resolution);
    expect(result.resolution).toBeLessThan(9);
    expect(result.indexes.length).toBeLessThanOrEqual(100);
    expect(
      result.indexes.every((index) => getResolution(index) === result.resolution),
    ).toBe(true);
  });

  it("falla de forma explícita si la resolución mínima excede el presupuesto", () => {
    expect(() =>
      generateH3Grid({
        bounds: {
          west: -79.2,
          south: -4.6,
          east: -66.5,
          north: 13.7,
        },
        requestedResolution: 4,
        supportedResolutions: [4],
        boundary: colombiaRectangle,
        maxCells: 1,
      }),
    ).toThrow(/acércate al mapa/);
  });
});
