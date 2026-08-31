import { AppError, notFound } from "../../../shared/errors/app-error.js";
import {
  HEATMAP_SCALE,
  heatmapStyle,
} from "../constants/heatmap.js";
import {
  assertValidH3Cell,
  h3Boundary,
  h3Cell,
  h3Center,
  h3Resolution,
} from "../h3/h3.js";
import { toHeatmapDto } from "../dto/heatmap.dto.js";
import { toPublicIncidentDto } from "../../incidents/dto/incident.dto.js";
import { oneCalendarYearBefore } from "../../../shared/utils/date-range.js";

export { oneCalendarYearBefore };

export function createGeolocationService({
  citiesRepository,
  heatmapRepository,
  incidentsRepository,
  config,
  clock = () => new Date(),
}) {
  function assertSupportedResolution(resolution) {
    if (!config.h3SupportedResolutions.includes(resolution)) {
      throw new AppError({
        code: "UNSUPPORTED_H3_RESOLUTION",
        message: "La resolucion H3 no esta habilitada",
        statusCode: 422,
      });
    }
  }

  async function assertCity(cityId) {
    const city = await citiesRepository.findActiveById(cityId);
    if (!city) {
      throw notFound("Ciudad");
    }
    return city;
  }

  function cell({ latitude, longitude, resolution }) {
    assertSupportedResolution(resolution);
    const index = h3Cell(latitude, longitude, resolution);
    const center = h3Center(index);
    return {
      h3Index: index,
      resolution,
      center: {
        latitude: center.latitude,
        longitude: center.longitude,
      },
      boundary: h3Boundary(index),
    };
  }

  function queryPeriod(input, timezone) {
    if (input.month) {
      return {
        mode: "month",
        month: input.month,
        timezone,
      };
    }

    const to = new Date(clock());
    const from = oneCalendarYearBefore(to);
    return {
      mode: "rolling_year",
      from: from.toISOString(),
      to: to.toISOString(),
      timezone,
    };
  }

  function periodQuery(period) {
    return period.mode === "month"
      ? { month: period.month }
      : {
          from: new Date(period.from),
          to: new Date(period.to),
        };
  }

  function formatStat(stat, incidentType, period) {
    const incidentCount = incidentType
      ? (stat.incidentTypes?.[incidentType] ?? 0)
      : stat.incidentCount;
    const style = heatmapStyle(incidentCount);

    return toHeatmapDto(
      {
        ...stat,
        incidentCount,
        incidentTypes: incidentType
          ? { [incidentType]: incidentCount }
          : stat.incidentTypes,
        level: style.level,
        color: style.color,
      },
      period,
    );
  }

  async function heatmap(input) {
    const city = await assertCity(input.cityId);
    assertSupportedResolution(input.resolution);
    const period = queryPeriod(input, city.timezone);
    const stats = await heatmapRepository.queryViewport({
      ...input,
      ...periodQuery(period),
    });

    return stats.map((stat) =>
      formatStat(stat, input.incidentType, period),
    );
  }

  async function cities() {
    const activeCities = await citiesRepository.listActive();
    return activeCities.map((city) => ({
      id: city._id.toHexString(),
      name: city.name,
      slug: city.slug,
      countryCode: city.countryCode,
      timezone: city.timezone,
      boundary: city.boundary ?? null,
      ...(city.center
        ? {
            center: {
              latitude: city.center.coordinates[1],
              longitude: city.center.coordinates[0],
            },
          }
        : {}),
      ...(city.bounds ? { bounds: city.bounds } : {}),
      ...(city.boundarySource
        ? { boundarySource: city.boundarySource }
        : {}),
    }));
  }

  function configuration() {
    const heatmapScale = HEATMAP_SCALE.map((entry) => ({
      ...entry,
      max: Number.isFinite(entry.max) ? entry.max : null,
    }));

    return {
      h3BaseResolution: config.h3BaseResolution,
      h3SupportedResolutions: config.h3SupportedResolutions,
      heatmapScale,
      h3: {
        baseResolution: config.h3BaseResolution,
        supportedResolutions: config.h3SupportedResolutions,
      },
      heatmap: {
        scale: heatmapScale,
      },
      coordinates: {
        geoJsonOrder: ["longitude", "latitude"],
        h3Order: ["latitude", "longitude"],
      },
    };
  }

  async function hexagon({ h3Index, cityId, month }) {
    assertValidH3Cell(h3Index);
    const city = await assertCity(cityId);
    const resolution = h3Resolution(h3Index);
    assertSupportedResolution(resolution);
    const period = queryPeriod({ month }, city.timezone);
    const temporalQuery = periodQuery(period);
    const [stat, incidents] = await Promise.all([
      heatmapRepository.findCell({
        cityId,
        ...temporalQuery,
        resolution,
        h3Index,
      }),
      incidentsRepository.listPublicByH3({
        cityId,
        h3Index,
        resolution,
        ...temporalQuery,
        timezone: city.timezone,
        limit: 50,
      }),
    ]);
    const center = h3Center(h3Index);

    return {
      h3Index,
      resolution,
      center: {
        latitude: center.latitude,
        longitude: center.longitude,
      },
      boundary: h3Boundary(h3Index),
      period,
      statistics: stat ? formatStat(stat, null, period) : null,
      incidents: incidents.map(toPublicIncidentDto),
    };
  }

  return Object.freeze({
    cities,
    configuration,
    cell,
    heatmap,
    hexagon,
  });
}
