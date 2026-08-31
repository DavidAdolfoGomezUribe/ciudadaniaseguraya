import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import { h3Cell, toGeoJsonPoint } from "../h3/h3.js";
import { backfillGeospatialData } from "../services/geospatial-backfill.service.js";

function sameId(left, right) {
  return (
    left?.equals?.(right) ??
    right?.equals?.(left) ??
    left === right
  );
}

function sameStatistic(document, filter) {
  return (
    sameId(document.cityId, filter.cityId) &&
    document.month === filter.month &&
    document.h3Resolution === filter.h3Resolution &&
    document.h3Index === filter.h3Index
  );
}

function fakeDatabase({ incidents, cities, statistics }) {
  const collections = {
    cities: {
      find() {
        return {
          async toArray() {
            return cities;
          },
        };
      },
    },
    incidents: {
      find() {
        return {
          async *[Symbol.asyncIterator]() {
            for (const incident of incidents) {
              yield {
                ...incident,
                h3Cells: { ...incident.h3Cells },
              };
            }
          },
        };
      },
      async bulkWrite(operations) {
        for (const { updateOne } of operations) {
          const incident = incidents.find(({ _id }) =>
            sameId(_id, updateOne.filter._id),
          );
          Object.assign(incident, updateOne.update.$set);
        }
      },
    },
    hex_monthly_stats: {
      async bulkWrite(operations) {
        for (const { updateOne } of operations) {
          let statistic = statistics.find((document) =>
            sameStatistic(document, updateOne.filter),
          );
          if (!statistic) {
            statistic = {};
            statistics.push(statistic);
          }
          Object.assign(statistic, updateOne.update.$set);
        }
      },
      async deleteMany(filter) {
        const runId = filter.geospatialBackfillRunId.$ne;
        const retained = statistics.filter(
          ({ geospatialBackfillRunId }) =>
            geospatialBackfillRunId === runId,
        );
        const deletedCount = statistics.length - retained.length;
        statistics.splice(0, statistics.length, ...retained);
        return { deletedCount };
      },
      async updateMany(filter) {
        for (const statistic of statistics) {
          if (
            statistic.geospatialBackfillRunId ===
            filter.geospatialBackfillRunId
          ) {
            delete statistic.geospatialBackfillRunId;
          }
        }
      },
    },
  };

  return {
    collection(name) {
      return collections[name];
    },
  };
}

function statisticsSnapshot(statistics) {
  return statistics.map(({ cityId, lastUpdatedAt, ...statistic }) => ({
    ...statistic,
    cityId: cityId.toHexString(),
    lastUpdatedAt: lastUpdatedAt.toISOString(),
  }));
}

describe("backfill geoespacial", () => {
  it("reconstruye H3 4-9 y agregados de forma idempotente", async () => {
    const now = new Date("2026-07-26T20:00:00.000Z");
    const cityId = new ObjectId();
    const point = toGeoJsonPoint({
      latitude: 4.711,
      longitude: -74.0721,
    });
    const oldBaseIndex = h3Cell(4.711, -74.0721, 9);
    const incidents = [
      {
        _id: new ObjectId(),
        cityId,
        incidentType: "robo",
        occurredAt: new Date("2026-07-15T15:00:00.000Z"),
        location: point,
        h3Cells: { 9: oldBaseIndex },
        h3Index: oldBaseIndex,
        h3Resolution: 9,
        status: "community_confirmed",
        statisticsApplied: false,
        deletedAt: null,
      },
      {
        _id: new ObjectId(),
        cityId,
        incidentType: "robo",
        occurredAt: new Date("2026-07-20T15:00:00.000Z"),
        location: point,
        h3Cells: { 9: oldBaseIndex },
        h3Index: oldBaseIndex,
        h3Resolution: 9,
        status: "admin_verified",
        statisticsApplied: false,
        deletedAt: null,
      },
      {
        _id: new ObjectId(),
        cityId,
        incidentType: "robo",
        occurredAt: new Date("2026-07-21T15:00:00.000Z"),
        location: point,
        h3Cells: { 9: oldBaseIndex },
        h3Index: oldBaseIndex,
        h3Resolution: 9,
        status: "pending",
        statisticsApplied: false,
        deletedAt: null,
      },
    ];
    const statistics = [
      {
        cityId,
        month: "2020-01",
        h3Resolution: 9,
        h3Index: oldBaseIndex,
        incidentCount: 99,
      },
    ];
    const db = fakeDatabase({
      incidents,
      cities: [{ _id: cityId, timezone: "America/Bogota" }],
      statistics,
    });
    const config = {
      cityTimezone: "America/Bogota",
      h3BaseResolution: 9,
      h3SupportedResolutions: [4, 5, 6, 7, 8, 9],
    };

    const first = await backfillGeospatialData({
      db,
      config,
      clock: () => now,
      batchSize: 2,
      runId: "first-run",
    });
    const firstSnapshot = statisticsSnapshot(statistics);
    const second = await backfillGeospatialData({
      db,
      config,
      clock: () => now,
      batchSize: 2,
      runId: "second-run",
    });

    expect(first).toMatchObject({
      processedIncidents: 3,
      updatedIncidents: 3,
      statisticsCells: 6,
      removedStaleStatistics: 1,
    });
    expect(second).toMatchObject({
      processedIncidents: 3,
      updatedIncidents: 0,
      statisticsCells: 6,
      removedStaleStatistics: 0,
    });
    expect(Object.keys(incidents[0].h3Cells)).toEqual([
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
    ]);
    expect(incidents.map(({ statisticsApplied }) => statisticsApplied)).toEqual(
      [true, true, false],
    );
    expect(statistics).toHaveLength(6);
    expect(
      statistics.every(
        ({ incidentCount, incidentTypes, level, color }) =>
          incidentCount === 2 &&
          incidentTypes.robo === 2 &&
          level === 1 &&
          color === "#22C55E",
      ),
    ).toBe(true);
    expect(statisticsSnapshot(statistics)).toEqual(firstSnapshot);
  });
});
