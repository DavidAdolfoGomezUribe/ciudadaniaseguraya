import { randomUUID } from "node:crypto";

import { heatmapStyle } from "../constants/heatmap.js";
import {
  coordinatesFromPoint,
  h3CellsForResolutions,
  h3Center,
} from "../h3/h3.js";
import { monthInTimezone } from "../../../shared/utils/time.js";

const visibleStatuses = new Set([
  "community_confirmed",
  "admin_verified",
]);

function identifier(value) {
  return value?.toHexString?.() ?? String(value);
}

function sameH3Cells(current, expected, resolutions) {
  const currentKeys = Object.keys(current ?? {});

  return (
    currentKeys.length === resolutions.length &&
    resolutions.every(
      (resolution) =>
        current?.[String(resolution)] === expected[String(resolution)],
    )
  );
}

function statisticsKey({
  cityId,
  month,
  h3Resolution,
  h3Index,
}) {
  return [
    identifier(cityId),
    month,
    h3Resolution,
    h3Index,
  ].join(":");
}

async function flushOperations(collection, operations) {
  if (operations.length === 0) {
    return;
  }

  const batch = operations.splice(0, operations.length);
  await collection.bulkWrite(batch, { ordered: false });
}

export function geospatialStateForIncident(incident, config) {
  const { latitude, longitude } = coordinatesFromPoint(
    incident.location,
  );
  const h3Cells = h3CellsForResolutions(
    latitude,
    longitude,
    config.h3SupportedResolutions,
  );

  return {
    h3Cells,
    h3Index: h3Cells[String(config.h3BaseResolution)],
    h3Resolution: config.h3BaseResolution,
    statisticsApplied:
      visibleStatuses.has(incident.status) &&
      (incident.deletedAt ?? null) === null,
  };
}

function addIncidentToStatistics({
  aggregates,
  incident,
  geospatialState,
  timezone,
}) {
  if (!geospatialState.statisticsApplied) {
    return;
  }

  const month = monthInTimezone(incident.occurredAt, timezone);

  for (const [resolution, h3Index] of Object.entries(
    geospatialState.h3Cells,
  )) {
    const identity = {
      cityId: incident.cityId,
      month,
      h3Resolution: Number(resolution),
      h3Index,
    };
    const key = statisticsKey(identity);
    const aggregate = aggregates.get(key) ?? {
      ...identity,
      center: h3Center(h3Index).point,
      incidentCount: 0,
      incidentTypes: {},
    };

    aggregate.incidentCount += 1;
    aggregate.incidentTypes[incident.incidentType] =
      (aggregate.incidentTypes[incident.incidentType] ?? 0) + 1;
    aggregates.set(key, aggregate);
  }
}

function incidentNeedsUpdate(incident, state, config) {
  return (
    incident.h3Index !== state.h3Index ||
    incident.h3Resolution !== state.h3Resolution ||
    incident.statisticsApplied !== state.statisticsApplied ||
    !sameH3Cells(
      incident.h3Cells,
      state.h3Cells,
      config.h3SupportedResolutions,
    )
  );
}

export async function backfillGeospatialData({
  db,
  config,
  clock = () => new Date(),
  batchSize = 500,
  runId = randomUUID(),
}) {
  if (!db || !config) {
    throw new Error("backfillGeospatialData requiere db y config");
  }
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error("batchSize debe ser un entero positivo");
  }

  const now = clock();
  const incidents = db.collection("incidents");
  const statistics = db.collection("hex_monthly_stats");
  const cities = await db
    .collection("cities")
    .find(
      {},
      {
        projection: {
          timezone: 1,
        },
      },
    )
    .toArray();
  const timezones = new Map(
    cities.map((city) => [
      identifier(city._id),
      city.timezone ?? config.cityTimezone,
    ]),
  );
  const aggregates = new Map();
  const incidentOperations = [];
  let processedIncidents = 0;
  let updatedIncidents = 0;

  const cursor = incidents.find(
    {},
    {
      projection: {
        cityId: 1,
        incidentType: 1,
        occurredAt: 1,
        location: 1,
        h3Cells: 1,
        h3Index: 1,
        h3Resolution: 1,
        status: 1,
        statisticsApplied: 1,
        deletedAt: 1,
      },
      sort: { _id: 1 },
    },
  );

  for await (const incident of cursor) {
    let state;
    try {
      state = geospatialStateForIncident(incident, config);
    } catch (error) {
      throw new Error(
        `No fue posible recalcular H3 para el incidente ${identifier(incident._id)}`,
        { cause: error },
      );
    }

    processedIncidents += 1;
    if (incidentNeedsUpdate(incident, state, config)) {
      incidentOperations.push({
        updateOne: {
          filter: { _id: incident._id },
          update: {
            $set: state,
          },
        },
      });
      updatedIncidents += 1;
    }

    addIncidentToStatistics({
      aggregates,
      incident,
      geospatialState: state,
      timezone:
        timezones.get(identifier(incident.cityId)) ??
        config.cityTimezone,
    });

    if (incidentOperations.length >= batchSize) {
      await flushOperations(incidents, incidentOperations);
    }
  }

  await flushOperations(incidents, incidentOperations);

  const statisticOperations = [];
  for (const aggregate of aggregates.values()) {
    const style = heatmapStyle(aggregate.incidentCount);
    const document = {
      ...aggregate,
      level: style.level,
      color: style.color,
      lastUpdatedAt: now,
      geospatialBackfillRunId: runId,
    };

    statisticOperations.push({
      updateOne: {
        filter: {
          cityId: aggregate.cityId,
          month: aggregate.month,
          h3Resolution: aggregate.h3Resolution,
          h3Index: aggregate.h3Index,
        },
        update: {
          $set: document,
        },
        upsert: true,
      },
    });

    if (statisticOperations.length >= batchSize) {
      await flushOperations(statistics, statisticOperations);
    }
  }

  await flushOperations(statistics, statisticOperations);
  const removed = await statistics.deleteMany({
    geospatialBackfillRunId: { $ne: runId },
    $or: [
      { lastUpdatedAt: { $lte: now } },
      { lastUpdatedAt: { $exists: false } },
    ],
  });
  await statistics.updateMany(
    { geospatialBackfillRunId: runId },
    { $unset: { geospatialBackfillRunId: "" } },
  );

  return {
    runId,
    processedIncidents,
    updatedIncidents,
    statisticsCells: aggregates.size,
    removedStaleStatistics: removed.deletedCount,
  };
}
