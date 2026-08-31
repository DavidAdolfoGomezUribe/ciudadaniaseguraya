import { describe, expect, it } from "vitest";

import { mergeHeatmapData } from "./merge-heatmap-data";

describe("mergeHeatmapData", () => {
  it("conserva estadisticas recibidas y completa celdas vacias", () => {
    const populated = {
      h3Index: "cell-with-data",
      resolution: 7,
      period: "rolling-year",
      incidentCount: 3,
      level: 2,
      color: "#EAB308",
      incidentTypes: { robo: 3 },
      lastUpdatedAt: "2026-07-26T18:00:00.000Z",
    };

    const result = mergeHeatmapData(
      ["empty-cell", "cell-with-data"],
      [populated],
      "rolling-year",
    );

    expect(result).toEqual([
      {
        h3Index: "empty-cell",
        resolution: null,
        period: "rolling-year",
        incidentCount: 0,
        level: 0,
        color: "#2563EB",
        incidentTypes: {},
        lastUpdatedAt: null,
      },
      populated,
    ]);
  });

  it("ignora estadisticas que no pertenecen a la cuadricula visible", () => {
    expect(
      mergeHeatmapData(
        ["visible"],
        [
          {
            h3Index: "outside",
            incidentCount: 8,
          },
        ],
        "rolling-year",
      ),
    ).toHaveLength(1);
  });

  it("maneja una cuadricula vacia sin inventar datos", () => {
    expect(mergeHeatmapData([], [], "rolling-year")).toEqual([]);
  });
});
