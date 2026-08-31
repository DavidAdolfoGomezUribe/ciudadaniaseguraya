import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";

import {
  BOGOTA_BOUNDARY,
  BOGOTA_BOUNDARY_SOURCE,
  BOGOTA_BOUNDS,
  BOGOTA_CENTER,
} from "../constants/bogota-geography.js";
import { h3Cell } from "../h3/h3.js";
import {
  createGeolocationService,
  oneCalendarYearBefore,
} from "../services/geolocation.service.js";

function fixture({
  clock = () => new Date("2026-07-27T15:00:00.000Z"),
  viewportStats = [],
  cellStat = null,
} = {}) {
  const cityId = new ObjectId();
  const city = {
    _id: cityId,
    name: "Bogota",
    slug: "bogota",
    countryCode: "CO",
    timezone: "America/Bogota",
    center: BOGOTA_CENTER,
    bounds: BOGOTA_BOUNDS,
    boundary: BOGOTA_BOUNDARY,
    boundarySource: BOGOTA_BOUNDARY_SOURCE,
  };
  const citiesRepository = {
    listActive: vi.fn().mockResolvedValue([city]),
    findActiveById: vi.fn().mockResolvedValue(city),
  };
  const heatmapRepository = {
    findCell: vi.fn().mockResolvedValue(cellStat),
    queryViewport: vi.fn().mockResolvedValue(viewportStats),
  };
  const incidentsRepository = {
    listPublicByH3: vi.fn().mockResolvedValue([]),
  };
  const config = {
    h3BaseResolution: 9,
    h3SupportedResolutions: [4, 5, 6, 7, 8, 9],
  };

  return {
    city,
    cityId,
    citiesRepository,
    heatmapRepository,
    incidentsRepository,
    service: createGeolocationService({
      citiesRepository,
      heatmapRepository,
      incidentsRepository,
      config,
      clock,
    }),
  };
}

describe("contrato publico del mapa", () => {
  it("calcula una ventana de doce meses que avanza en el aniversario exacto", () => {
    const occurredAt = new Date("2026-01-01T12:30:00.000Z");
    const atAnniversary = oneCalendarYearBefore(
      new Date("2027-01-01T12:30:00.000Z"),
    );
    const afterAnniversary = oneCalendarYearBefore(
      new Date("2027-01-01T12:30:00.001Z"),
    );

    expect(atAnniversary.toISOString()).toBe(
      "2026-01-01T12:30:00.000Z",
    );
    expect(afterAnniversary.toISOString()).toBe(
      "2026-01-01T12:30:00.001Z",
    );
    expect(occurredAt >= atAnniversary).toBe(true);
    expect(occurredAt >= afterAnniversary).toBe(false);
    expect(
      oneCalendarYearBefore(
        new Date("2024-02-29T12:30:00.000Z"),
      ).toISOString(),
    ).toBe("2023-02-28T12:30:00.000Z");
  });

  it("expone limites, centro, bounds y configuracion H3/escala", async () => {
    const { service } = fixture();

    await expect(service.cities()).resolves.toEqual([
      expect.objectContaining({
        slug: "bogota",
        center: {
          latitude: 4.711,
          longitude: -74.0721,
        },
        bounds: BOGOTA_BOUNDS,
        boundary: BOGOTA_BOUNDARY,
        boundarySource: BOGOTA_BOUNDARY_SOURCE,
      }),
    ]);
    expect(service.configuration()).toMatchObject({
      h3BaseResolution: 9,
      h3SupportedResolutions: [4, 5, 6, 7, 8, 9],
      heatmapScale: expect.any(Array),
      h3: {
        baseResolution: 9,
        supportedResolutions: [4, 5, 6, 7, 8, 9],
      },
      heatmap: {
        scale: [
          { level: 0, min: 0, max: 0, color: "#2563EB" },
          { level: 1, min: 1, max: 2, color: "#22C55E" },
          { level: 2, min: 3, max: 5, color: "#EAB308" },
          { level: 3, min: 6, max: 9, color: "#F97316" },
          { level: 4, min: 10, max: 19, color: "#EF4444" },
          { level: 5, min: 20, max: null, color: "#111827" },
        ],
      },
    });
  });

  it("filtra los incidentes del hexagono por mes y zona local", async () => {
    const {
      cityId,
      incidentsRepository,
      service,
    } = fixture();
    const h3Index = h3Cell(4.711, -74.0721, 9);

    await service.hexagon({
      h3Index,
      cityId: cityId.toHexString(),
      month: "2026-07",
    });

    expect(incidentsRepository.listPublicByH3).toHaveBeenCalledWith({
      cityId: cityId.toHexString(),
      h3Index,
      resolution: 9,
      month: "2026-07",
      timezone: "America/Bogota",
      limit: 50,
    });
  });

  it("usa el ultimo año por defecto y recalcula el estilo del mapa", async () => {
    const now = new Date("2027-01-01T12:30:00.000Z");
    const lastUpdatedAt = new Date("2026-12-20T10:00:00.000Z");
    const { cityId, heatmapRepository, service } = fixture({
      clock: () => now,
      viewportStats: [
        {
          h3Index: h3Cell(4.711, -74.0721, 9),
          h3Resolution: 9,
          month: null,
          incidentCount: 1,
          incidentTypes: { robo: 1 },
          lastUpdatedAt,
        },
      ],
    });
    const bounds = {
      north: 4.8,
      south: 4.6,
      east: -73.9,
      west: -74.2,
    };

    const result = await service.heatmap({
      cityId: cityId.toHexString(),
      resolution: 9,
      ...bounds,
    });

    expect(heatmapRepository.queryViewport).toHaveBeenCalledWith({
      cityId: cityId.toHexString(),
      resolution: 9,
      ...bounds,
      from: new Date("2026-01-01T12:30:00.000Z"),
      to: now,
    });
    expect(result[0]).toMatchObject({
      month: null,
      incidentCount: 1,
      level: 1,
      color: "#22C55E",
      period: {
        mode: "rolling_year",
        from: "2026-01-01T12:30:00.000Z",
        to: "2027-01-01T12:30:00.000Z",
        timezone: "America/Bogota",
      },
    });
  });

  it("consulta el detalle anual por defecto con los mismos limites", async () => {
    const now = new Date("2027-03-15T08:00:00.000Z");
    const { cityId, heatmapRepository, incidentsRepository, service } =
      fixture({ clock: () => now });
    const h3Index = h3Cell(4.711, -74.0721, 9);
    const expectedRange = {
      from: new Date("2026-03-15T08:00:00.000Z"),
      to: now,
    };

    const result = await service.hexagon({
      h3Index,
      cityId: cityId.toHexString(),
    });

    expect(heatmapRepository.findCell).toHaveBeenCalledWith({
      cityId: cityId.toHexString(),
      h3Index,
      resolution: 9,
      ...expectedRange,
    });
    expect(incidentsRepository.listPublicByH3).toHaveBeenCalledWith({
      cityId: cityId.toHexString(),
      h3Index,
      resolution: 9,
      ...expectedRange,
      timezone: "America/Bogota",
      limit: 50,
    });
    expect(result.period).toMatchObject({
      mode: "rolling_year",
      from: expectedRange.from.toISOString(),
      to: expectedRange.to.toISOString(),
    });
  });
});
