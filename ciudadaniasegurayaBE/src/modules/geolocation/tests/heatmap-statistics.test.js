import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";

import { h3Cell, toGeoJsonPoint } from "../h3/h3.js";
import { createHeatmapStatisticsService } from "../services/heatmap-statistics.service.js";

describe("agregados H3 en tiempo real", () => {
  it("actualiza todas las resoluciones y publica cambios granulares", async () => {
    const now = new Date("2026-07-26T19:30:00.000Z");
    const cityId = new ObjectId();
    const incidentId = new ObjectId();
    const baseIndex = h3Cell(4.711, -74.0721, 9);
    const incident = {
      _id: incidentId,
      cityId,
      incidentType: "robo",
      occurredAt: new Date("2026-07-01T04:30:00.000Z"),
      location: toGeoJsonPoint({
        latitude: 4.711,
        longitude: -74.0721,
      }),
      h3Cells: { 9: baseIndex },
      h3Index: baseIndex,
      h3Resolution: 9,
    };
    const incidentsRepository = {
      claimStatistics: vi.fn().mockResolvedValue(incident),
      updateGeospatialIndexes: vi.fn().mockResolvedValue(undefined),
      setStatisticsApplied: vi.fn(),
    };
    const heatmapRepository = {
      adjustMany: vi.fn().mockImplementation(
        async (adjustments, _delta, updateTime) =>
          adjustments.map((adjustment, index) => ({
            _id: `stat-${index}`,
            ...adjustment,
            incidentCount: 1,
            incidentTypes: { robo: 1 },
            lastUpdatedAt: updateTime,
          })),
      ),
      updateStyles: vi.fn().mockResolvedValue(undefined),
    };
    const eventBus = { publish: vi.fn() };
    const service = createHeatmapStatisticsService({
      incidentsRepository,
      heatmapRepository,
      citiesRepository: {
        findActiveById: vi.fn().mockResolvedValue({
          timezone: "America/Bogota",
        }),
      },
      eventBus,
      config: {
        cityTimezone: "America/Bogota",
        h3BaseResolution: 9,
        h3SupportedResolutions: [4, 5, 6, 7, 8, 9],
      },
      clock: () => now,
    });

    await expect(service.apply(incidentId)).resolves.toBe(true);

    const [geospatialUpdate] =
      incidentsRepository.updateGeospatialIndexes.mock.calls[0].slice(1);
    expect(Object.keys(geospatialUpdate.h3Cells)).toEqual([
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
    ]);
    const [adjustments, delta] =
      heatmapRepository.adjustMany.mock.calls[0];
    expect(delta).toBe(1);
    expect(
      adjustments.map(({ h3Resolution }) => h3Resolution),
    ).toEqual([4, 5, 6, 7, 8, 9]);
    expect(adjustments.every(({ month }) => month === "2026-06")).toBe(
      true,
    );

    expect(eventBus.publish).toHaveBeenCalledTimes(1);
    const [eventType, payload] = eventBus.publish.mock.calls[0];
    expect(eventType).toBe("heatmap.updated");
    expect(payload).toMatchObject({
      cityId: cityId.toHexString(),
      months: ["2026-06"],
      resolutions: [4, 5, 6, 7, 8, 9],
      occurredAt: now.toISOString(),
    });
    expect(payload.updates).toHaveLength(6);
    expect(payload.updates[0]).toMatchObject({
      month: "2026-06",
      resolution: 4,
      h3Index: expect.any(String),
      incidentType: "robo",
      incidentCount: 1,
      level: 1,
      color: "#22C55E",
      incidentTypeCount: 1,
      lastUpdatedAt: now.toISOString(),
    });
  });
});
