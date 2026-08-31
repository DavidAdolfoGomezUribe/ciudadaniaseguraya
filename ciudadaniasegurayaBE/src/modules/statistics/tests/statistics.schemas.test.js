import { describe, expect, it } from "vitest";

import {
  hexagonStatisticsQuerySchema,
  statisticsOverviewQuerySchema,
  statisticsTimeseriesQuerySchema,
} from "../validators/statistics.schemas.js";

describe("schemas HTTP de estadisticas", () => {
  it("aplica la agrupacion predeterminada y deja la zona al servicio", () => {
    expect(statisticsTimeseriesQuerySchema.parse({})).toEqual({
      groupBy: "month",
    });
    expect(hexagonStatisticsQuerySchema.parse({})).toEqual({
      groupBy: "month",
    });
  });

  it("rechaza rangos invertidos y campos desconocidos", () => {
    expect(
      statisticsOverviewQuerySchema.safeParse({
        from: "2026-08-01T00:00:00.000Z",
        to: "2026-07-01T00:00:00.000Z",
      }).success,
    ).toBe(false);
    expect(
      statisticsOverviewQuerySchema.safeParse({ status: "pending" }).success,
    ).toBe(false);
  });

  it("rechaza categorias, agrupaciones y zonas mal formadas", () => {
    expect(
      statisticsTimeseriesQuerySchema.safeParse({
        incidentType: "categoria_inexistente",
      }).success,
    ).toBe(false);
    expect(
      statisticsTimeseriesQuerySchema.safeParse({ groupBy: "week" }).success,
    ).toBe(false);
    expect(
      statisticsTimeseriesQuerySchema.safeParse({
        timezone: "America/Bogota<script>",
      }).success,
    ).toBe(false);
  });
});
