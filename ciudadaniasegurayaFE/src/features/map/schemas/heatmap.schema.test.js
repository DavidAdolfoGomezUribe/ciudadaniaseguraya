import { describe, expect, it } from "vitest";

import { heatmapCellSchema, hexagonDetailSchema } from "./heatmap.schema";

const annualCell = {
  h3Index: "8966e42888fffff",
  resolution: 9,
  month: null,
  period: {
    mode: "rolling_year",
    from: "2025-07-27T14:00:00.000Z",
    to: "2026-07-27T14:00:00.000Z",
    timezone: "America/Bogota",
  },
  incidentCount: 35,
  level: 5,
  color: "#111827",
  incidentTypes: { robo: 35 },
  lastUpdatedAt: "2026-07-27T13:45:00.000Z",
};

describe("contrato del mapa H3", () => {
  it("acepta la celda anual real del backend con month nulo", () => {
    expect(heatmapCellSchema.parse(annualCell)).toMatchObject({
      h3Index: annualCell.h3Index,
      period: "rolling-year",
      incidentCount: 35,
      color: "#111827",
    });
  });

  it("acepta el detalle anual con estadísticas no vacías", () => {
    const result = hexagonDetailSchema.parse({
      h3Index: annualCell.h3Index,
      resolution: 9,
      center: { latitude: 4.7008, longitude: -74.0302 },
      boundary: {
        type: "Polygon",
        coordinates: [[]],
      },
      period: annualCell.period,
      statistics: annualCell,
      incidents: [],
    });

    expect(result.statistics?.period).toBe("rolling-year");
    expect(result.statistics?.incidentCount).toBe(35);
  });

  it("mantiene compatible el periodo mensual histórico", () => {
    const result = heatmapCellSchema.parse({
      ...annualCell,
      month: "2026-07",
      period: {
        mode: "month",
        month: "2026-07",
        timezone: "America/Bogota",
      },
    });

    expect(result.period).toBe("2026-07");
  });
});
