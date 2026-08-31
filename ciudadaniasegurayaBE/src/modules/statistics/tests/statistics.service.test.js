import { describe, expect, it, vi } from "vitest";

import { h3Cell } from "../../geolocation/h3/h3.js";
import { INCIDENT_TYPES } from "../../incidents/constants/incident-types.js";
import { createStatisticsService } from "../services/statistics.service.js";

const cityId = "507f1f77bcf86cd799439011";
const fixedNow = new Date("2026-07-26T20:00:00.000Z");
const emptyOverview = {
  incidentCount: 0,
  communityConfirmedCount: 0,
  adminVerifiedCount: 0,
  firstOccurredAt: null,
  lastOccurredAt: null,
  lastUpdatedAt: null,
};

function dependencies(overrides = {}) {
  const statisticsRepository = {
    overview: vi.fn().mockResolvedValue(emptyOverview),
    timeseries: vi.fn().mockResolvedValue([]),
    hourly: vi.fn().mockResolvedValue([]),
    types: vi.fn().mockResolvedValue([]),
    byHexagons: vi.fn().mockResolvedValue([]),
    ...overrides.statisticsRepository,
  };
  const citiesRepository = {
    findActiveById: vi.fn().mockResolvedValue({
      name: "Bogota",
      countryCode: "CO",
      timezone: "America/Bogota",
      active: true,
    }),
    ...overrides.citiesRepository,
  };
  const config = {
    cityTimezone: "America/Bogota",
    defaultCityCountryCode: "CO",
    h3SupportedResolutions: [7, 8, 9],
    ...overrides.config,
  };

  return {
    citiesRepository,
    config,
    statisticsRepository,
    service: createStatisticsService({
      statisticsRepository,
      citiesRepository,
      config,
      clock: () => fixedNow,
    }),
  };
}

describe("servicio de estadisticas", () => {
  it("normaliza alcance, periodo y comparacion del resumen", async () => {
    const current = {
      incidentCount: 6,
      communityConfirmedCount: 4,
      adminVerifiedCount: 2,
      firstOccurredAt: new Date("2026-07-02T12:00:00.000Z"),
      lastOccurredAt: new Date("2026-07-20T18:00:00.000Z"),
      lastUpdatedAt: new Date("2026-07-21T18:00:00.000Z"),
    };
    const previous = { ...emptyOverview, incidentCount: 3 };
    const { service, statisticsRepository } = dependencies({
      statisticsRepository: {
        overview: vi
          .fn()
          .mockResolvedValueOnce(current)
          .mockResolvedValueOnce(previous),
      },
    });

    const result = await service.overview({
      cityId,
      from: "2026-07-01T00:00:00.000Z",
      to: "2026-08-01T00:00:00.000Z",
      timezone: "America/Bogota",
      incidentType: "robo",
    });

    expect(result).toMatchObject({
      scope: { type: "city", cityId, cityName: "Bogota" },
      period: {
        from: "2026-07-01T00:00:00.000Z",
        to: "2026-08-01T00:00:00.000Z",
        timezone: "America/Bogota",
      },
      filters: { incidentType: "robo" },
      totalIncidents: 6,
      validation: {
        communityConfirmed: 4,
        adminVerified: 2,
      },
      comparison: {
        previousIncidentCount: 3,
        absoluteChange: 3,
        percentageChange: 100,
      },
    });
    expect(statisticsRepository.overview).toHaveBeenCalledTimes(2);
    const previousQuery = statisticsRepository.overview.mock.calls[1][0];
    expect(previousQuery.to.getTime()).toBe(
      new Date("2026-07-01T00:00:00.000Z").getTime() - 1,
    );
  });

  it("usa el último año calendario y alcance país por defecto", async () => {
    const { service, statisticsRepository } = dependencies();

    const result = await service.overview({});
    const currentQuery = statisticsRepository.overview.mock.calls[0][0];

    expect(result.scope).toEqual({ type: "country", countryCode: "CO" });
    expect(result.period.to).toBe(fixedNow.toISOString());
    expect(currentQuery.to).toEqual(fixedNow);
    expect(currentQuery.from).toEqual(
      new Date("2025-07-26T20:00:00.000Z"),
    );
  });

  it("formatea etiquetas de una serie mensual", async () => {
    const { service } = dependencies({
      statisticsRepository: {
        timeseries: vi.fn().mockResolvedValue([
          {
            key: "2026-07",
            incidentCount: 4,
            lastUpdatedAt: new Date("2026-07-20T00:00:00.000Z"),
          },
        ]),
      },
    });

    const result = await service.timeseries({
      from: "2026-01-01T00:00:00.000Z",
      to: "2027-01-01T00:00:00.000Z",
      groupBy: "month",
    });

    expect(result).toMatchObject({
      groupBy: "month",
      totalIncidents: 4,
      series: [
        {
          key: "2026-07",
          label: "Julio 2026",
          incidentCount: 4,
        },
      ],
    });
  });

  it("completa las 24 horas y calcula resumen horario", async () => {
    const { service } = dependencies({
      statisticsRepository: {
        hourly: vi.fn().mockResolvedValue([
          { hour: 2, incidentCount: 1 },
          { hour: 18, incidentCount: 3 },
        ]),
      },
    });

    const result = await service.hourly({});

    expect(result.series).toHaveLength(24);
    expect(result.series[2]).toMatchObject({
      label: "02:00",
      incidentCount: 1,
    });
    expect(result.series[18]).toMatchObject({
      label: "18:00",
      incidentCount: 3,
    });
    expect(result.summary).toMatchObject({
      totalIncidents: 4,
      averagePerHour: 0.17,
      busiestHours: [18],
    });
    expect(result.summary.quietestHours).toContain(0);
  });

  it("incluye categorias sin registros y porcentajes", async () => {
    const { service } = dependencies({
      statisticsRepository: {
        types: vi.fn().mockResolvedValue([
          { incidentType: "robo", incidentCount: 3 },
          { incidentType: "hurto", incidentCount: 1 },
        ]),
      },
    });

    const result = await service.types({});
    const robbery = result.series.find(
      ({ incidentType }) => incidentType === "robo",
    );
    const homicide = result.series.find(
      ({ incidentType }) => incidentType === "homicidio",
    );

    expect(result.totalIncidents).toBe(4);
    expect(result.series).toHaveLength(INCIDENT_TYPES.length);
    expect(robbery.percentage).toBe(75);
    expect(homicide.incidentCount).toBe(0);
  });

  it("combina todas las agregaciones para un hexagono", async () => {
    const h3Index = "8966e42888fffff";
    const { service, statisticsRepository } = dependencies();

    const result = await service.hexagon({
      h3Index,
      cityId,
      groupBy: "day",
    });

    expect(result.scope).toMatchObject({
      type: "hexagon",
      h3Index,
      resolution: 9,
      cityId,
    });
    expect(statisticsRepository.overview).toHaveBeenCalledTimes(2);
    expect(statisticsRepository.timeseries).toHaveBeenCalledOnce();
    expect(statisticsRepository.hourly).toHaveBeenCalledOnce();
    expect(statisticsRepository.types).toHaveBeenCalledOnce();
    expect(statisticsRepository.byHexagons).toHaveBeenCalledOnce();
    expect(statisticsRepository.timeseries.mock.calls[0][0]).toMatchObject({
      h3Index,
      h3Resolution: 9,
      groupBy: "day",
    });
    expect(result.nearbyComparison.neighbors).toHaveLength(6);
    expect(result.nearbyComparison.center).toEqual({
      h3Index,
      incidentCount: 0,
    });
  });

  it("rechaza zona horaria, ciudad y resolucion H3 no admitidas", async () => {
    const { service } = dependencies({
      citiesRepository: { findActiveById: vi.fn().mockResolvedValue(null) },
    });
    const unsupportedH3 = h3Cell(4.711, -74.0721, 5);

    await expect(service.overview({ timezone: "Zona/Inexistente" })).rejects
      .toMatchObject({ code: "INVALID_TIMEZONE", statusCode: 422 });
    await expect(service.overview({ cityId })).rejects.toMatchObject({
      code: "NOT_FOUND",
      statusCode: 404,
    });
    await expect(service.overview({ h3Index: unsupportedH3 })).rejects
      .toMatchObject({
        code: "UNSUPPORTED_H3_RESOLUTION",
        statusCode: 422,
      });
  });
});
