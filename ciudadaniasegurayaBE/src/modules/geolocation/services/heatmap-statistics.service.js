import { heatmapStyle } from "../constants/heatmap.js";
import {
  coordinatesFromPoint,
  h3CellsForResolutions,
  h3Center,
} from "../h3/h3.js";
import { monthInTimezone } from "../../../shared/utils/time.js";

export function createHeatmapStatisticsService({
  incidentsRepository,
  heatmapRepository,
  citiesRepository,
  eventBus,
  config,
  clock = () => new Date(),
}) {
  async function ensureGeospatialIndexes(incident, now) {
    const { latitude, longitude } = coordinatesFromPoint(
      incident.location,
    );
    const h3Cells = h3CellsForResolutions(
      latitude,
      longitude,
      config.h3SupportedResolutions,
    );
    const h3Index = h3Cells[String(config.h3BaseResolution)];
    const unchanged =
      incident.h3Resolution === config.h3BaseResolution &&
      incident.h3Index === h3Index &&
      config.h3SupportedResolutions.every(
        (resolution) =>
          incident.h3Cells?.[String(resolution)] ===
          h3Cells[String(resolution)],
      );

    if (!unchanged) {
      await incidentsRepository.updateGeospatialIndexes(
        incident._id,
        {
          h3Cells,
          h3Index,
          h3Resolution: config.h3BaseResolution,
        },
        now,
      );
    }

    return {
      ...incident,
      h3Cells,
      h3Index,
      h3Resolution: config.h3BaseResolution,
    };
  }

  async function adjustmentsForIncident(incident) {
    const city = await citiesRepository.findActiveById(incident.cityId);
    const timezone = city?.timezone ?? config.cityTimezone;
    const month = monthInTimezone(incident.occurredAt, timezone);

    return config.h3SupportedResolutions.map((resolution) => {
      const index = incident.h3Cells[String(resolution)];
      return {
        cityId: incident.cityId,
        month,
        h3Resolution: resolution,
        h3Index: index,
        center: h3Center(index).point,
        incidentType: incident.incidentType,
      };
    });
  }

  function withStyles(stats) {
    return stats.map((stat) => {
      const style = heatmapStyle(stat.incidentCount);
      return {
        ...stat,
        level: style.level,
        color: style.color,
      };
    });
  }

  async function updateStyles(stats, now) {
    await heatmapRepository.updateStyles(
      stats.map((stat) => ({
        id: stat._id,
        incidentCount: stat.incidentCount,
        level: stat.level,
        color: stat.color,
      })),
      now,
    );
  }

  function adjustmentKey({ month, h3Resolution, h3Index }) {
    return `${month}:${h3Resolution}:${h3Index}`;
  }

  function granularUpdates(adjustments, stats, now) {
    const statsByCell = new Map(
      stats.map((stat) => [adjustmentKey(stat), stat]),
    );

    return adjustments.map((adjustment) => {
      const stat = statsByCell.get(adjustmentKey(adjustment));
      const incidentCount = Math.max(0, stat?.incidentCount ?? 0);
      const incidentTypes = Object.fromEntries(
        Object.entries(stat?.incidentTypes ?? {}).filter(
          ([, count]) => count > 0,
        ),
      );
      const incidentTypeCount =
        incidentTypes[adjustment.incidentType] ?? 0;
      const incidentTypeStyle = heatmapStyle(incidentTypeCount);
      const style = heatmapStyle(incidentCount);

      return {
        month: adjustment.month,
        resolution: adjustment.h3Resolution,
        h3Index: adjustment.h3Index,
        incidentType: adjustment.incidentType,
        incidentCount,
        level: style.level,
        color: style.color,
        incidentTypes,
        incidentTypeCount,
        incidentTypeLevel: incidentTypeStyle.level,
        incidentTypeColor: incidentTypeStyle.color,
        lastUpdatedAt: now.toISOString(),
      };
    });
  }

  function emitUpdate(incident, adjustments, stats, now) {
    eventBus.publish("heatmap.updated", {
      cityId: incident.cityId.toHexString(),
      months: [...new Set(adjustments.map(({ month }) => month))],
      resolutions: [
        ...new Set(
          adjustments.map(({ h3Resolution }) => h3Resolution),
        ),
      ],
      updates: granularUpdates(adjustments, stats, now),
      occurredAt: now.toISOString(),
    });
  }

  async function apply(incidentId) {
    const now = clock();
    const incident = await incidentsRepository.claimStatistics(
      incidentId,
      now,
    );

    if (!incident) {
      return false;
    }

    try {
      const normalizedIncident = await ensureGeospatialIndexes(
        incident,
        now,
      );
      const adjustments =
        await adjustmentsForIncident(normalizedIncident);
      const stats = withStyles(
        await heatmapRepository.adjustMany(adjustments, 1, now),
      );
      await updateStyles(stats, now);
      emitUpdate(normalizedIncident, adjustments, stats, now);
      return true;
    } catch (error) {
      await incidentsRepository.setStatisticsApplied(
        incidentId,
        false,
        now,
      );
      throw error;
    }
  }

  async function remove(incidentId) {
    const now = clock();
    const incident = await incidentsRepository.releaseStatistics(
      incidentId,
      now,
    );

    if (!incident) {
      return false;
    }

    try {
      const normalizedIncident = await ensureGeospatialIndexes(
        incident,
        now,
      );
      const adjustments =
        await adjustmentsForIncident(normalizedIncident);
      const stats = withStyles(
        await heatmapRepository.adjustMany(adjustments, -1, now),
      );
      await updateStyles(stats, now);
      emitUpdate(normalizedIncident, adjustments, stats, now);
      return true;
    } catch (error) {
      await incidentsRepository.setStatisticsApplied(
        incidentId,
        true,
        now,
      );
      throw error;
    }
  }

  return Object.freeze({
    apply,
    remove,
  });
}
