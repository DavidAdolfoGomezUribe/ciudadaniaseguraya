import { AppError, notFound } from "../../../shared/errors/app-error.js";
import {
  assertValidH3Cell,
  h3Resolution,
  neighboringCells,
} from "../../geolocation/h3/h3.js";
import { INCIDENT_TYPES } from "../../incidents/constants/incident-types.js";
import { oneCalendarYearBefore } from "../../../shared/utils/date-range.js";

const MONTH_NAMES = Object.freeze([
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]);

function assertTimezone(timezone) {
  try {
    new Intl.DateTimeFormat("es-CO", { timeZone: timezone }).format();
  } catch (_error) {
    throw new AppError({
      code: "INVALID_TIMEZONE",
      message: "La zona horaria no es valida",
      statusCode: 422,
    });
  }
}

function asIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function latestUpdate(rows) {
  const timestamps = rows
    .map(({ lastUpdatedAt }) => lastUpdatedAt)
    .filter(Boolean)
    .map((value) => new Date(value).getTime());
  return timestamps.length === 0
    ? null
    : new Date(Math.max(...timestamps)).toISOString();
}

function seriesLabel(key, groupBy) {
  if (groupBy === "month") {
    const [year, month] = key.split("-");
    return `${MONTH_NAMES[Number(month) - 1] ?? month} ${year}`;
  }
  if (groupBy === "hour") {
    return key.replace("T", " ");
  }
  return key;
}

function formatOverview(current, previous, previousPeriod) {
  const absoluteChange = current.incidentCount - previous.incidentCount;
  const percentageChange =
    previous.incidentCount === 0
      ? current.incidentCount === 0
        ? 0
        : null
      : round((absoluteChange / previous.incidentCount) * 100);

  return {
    totalIncidents: current.incidentCount,
    validation: {
      communityConfirmed: current.communityConfirmedCount,
      adminVerified: current.adminVerifiedCount,
    },
    firstIncidentAt: asIso(current.firstOccurredAt),
    lastIncidentAt: asIso(current.lastOccurredAt),
    lastUpdatedAt: asIso(current.lastUpdatedAt),
    comparison: {
      period: {
        from: previousPeriod.from.toISOString(),
        to: previousPeriod.to.toISOString(),
      },
      previousIncidentCount: previous.incidentCount,
      absoluteChange,
      percentageChange,
    },
  };
}

function formatTimeseries(rows, groupBy) {
  return rows.map((row) => ({
    key: row.key,
    label: seriesLabel(row.key, groupBy),
    incidentCount: row.incidentCount,
    lastUpdatedAt: asIso(row.lastUpdatedAt),
  }));
}

function formatHourly(rows) {
  const counts = new Map(rows.map((row) => [row.hour, row.incidentCount]));
  const series = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    key: String(hour).padStart(2, "0"),
    label: `${String(hour).padStart(2, "0")}:00`,
    incidentCount: counts.get(hour) ?? 0,
  }));
  const totalIncidents = series.reduce(
    (total, item) => total + item.incidentCount,
    0,
  );
  const maximum = Math.max(...series.map(({ incidentCount }) => incidentCount));
  const minimum = Math.min(...series.map(({ incidentCount }) => incidentCount));

  return {
    series,
    lastUpdatedAt: latestUpdate(rows),
    summary: {
      totalIncidents,
      averagePerHour: round(totalIncidents / 24),
      busiestHours:
        totalIncidents === 0
          ? []
          : series
              .filter(({ incidentCount }) => incidentCount === maximum)
              .map(({ hour }) => hour),
      quietestHours:
        totalIncidents === 0
          ? []
          : series
              .filter(({ incidentCount }) => incidentCount === minimum)
              .map(({ hour }) => hour),
    },
  };
}

function formatTypes(rows) {
  const counts = new Map(
    rows.map((row) => [row.incidentType, row.incidentCount]),
  );
  const totalIncidents = rows.reduce(
    (total, row) => total + row.incidentCount,
    0,
  );
  const series = INCIDENT_TYPES.map((definition) => {
    const incidentCount = counts.get(definition.code) ?? 0;
    return {
      incidentType: definition.code,
      label: definition.name,
      description: definition.description,
      severity: definition.severity,
      incidentCount,
      percentage:
        totalIncidents === 0
          ? 0
          : round((incidentCount / totalIncidents) * 100),
    };
  }).sort(
    (left, right) =>
      right.incidentCount - left.incidentCount ||
      left.label.localeCompare(right.label, "es"),
  );

  return {
    series,
    totalIncidents,
    lastUpdatedAt: latestUpdate(rows),
  };
}

function formatNearbyComparison(h3Index, indexes, rows) {
  const counts = new Map(
    rows.map((row) => [row.h3Index, row.incidentCount]),
  );
  const centerIncidentCount = counts.get(h3Index) ?? 0;
  const neighbors = indexes
    .filter((index) => index !== h3Index)
    .map((index) => ({
      h3Index: index,
      incidentCount: counts.get(index) ?? 0,
    }));
  const averageNeighborCount =
    neighbors.length === 0
      ? 0
      : round(
          neighbors.reduce(
            (total, neighbor) => total + neighbor.incidentCount,
            0,
          ) / neighbors.length,
        );
  const absoluteDifference = round(
    centerIncidentCount - averageNeighborCount,
  );

  return {
    center: {
      h3Index,
      incidentCount: centerIncidentCount,
    },
    neighbors,
    averageNeighborCount,
    absoluteDifference,
    percentageDifference:
      averageNeighborCount === 0
        ? centerIncidentCount === 0
          ? 0
          : null
        : round((absoluteDifference / averageNeighborCount) * 100),
    lastUpdatedAt: latestUpdate(rows),
  };
}

export function createStatisticsService({
  statisticsRepository,
  citiesRepository,
  config,
  clock = () => new Date(),
}) {
  async function prepare(input) {
    const to = input.to ? new Date(input.to) : clock();
    const from = input.from
      ? new Date(input.from)
      : oneCalendarYearBefore(to);

    if (
      !Number.isFinite(from.getTime()) ||
      !Number.isFinite(to.getTime()) ||
      from.getTime() >= to.getTime()
    ) {
      throw new AppError({
        code: "INVALID_DATE_RANGE",
        message: "El rango de fechas no es valido",
        statusCode: 422,
      });
    }

    let city = null;
    if (input.cityId) {
      city = await citiesRepository.findActiveById(input.cityId);
      if (!city) {
        throw notFound("Ciudad");
      }
    }

    const timezone =
      input.timezone ?? city?.timezone ?? config.cityTimezone;
    assertTimezone(timezone);

    let resolution;
    if (input.h3Index) {
      assertValidH3Cell(input.h3Index);
      resolution = h3Resolution(input.h3Index);
      if (!config.h3SupportedResolutions.includes(resolution)) {
        throw new AppError({
          code: "UNSUPPORTED_H3_RESOLUTION",
          message: "La resolucion H3 no esta habilitada",
          statusCode: 422,
        });
      }
    }

    const scope = input.h3Index
      ? {
          type: "hexagon",
          h3Index: input.h3Index,
          resolution,
          ...(city
            ? {
                cityId: input.cityId,
                cityName: city.name,
              }
            : {}),
        }
      : city
        ? {
            type: "city",
            cityId: input.cityId,
            cityName: city.name,
          }
        : {
            type: "country",
            countryCode: config.defaultCityCountryCode,
          };

    return {
      query: {
        cityId: input.cityId,
        h3Index: input.h3Index,
        h3Resolution: resolution,
        from,
        to,
        incidentType: input.incidentType,
        timezone,
        groupBy: input.groupBy ?? "month",
      },
      scope,
      period: {
        from: from.toISOString(),
        to: to.toISOString(),
        timezone,
      },
      filters: {
        incidentType: input.incidentType ?? null,
      },
    };
  }

  function previousQuery(query) {
    const duration = query.to.getTime() - query.from.getTime();
    const to = new Date(query.from.getTime() - 1);
    const from = new Date(to.getTime() - duration);
    return { ...query, from, to };
  }

  function context(context) {
    return {
      scope: context.scope,
      period: context.period,
      filters: context.filters,
    };
  }

  async function overview(input) {
    const prepared = await prepare(input);
    const previous = previousQuery(prepared.query);
    const [current, previousOverview] = await Promise.all([
      statisticsRepository.overview(prepared.query),
      statisticsRepository.overview(previous),
    ]);

    return {
      ...context(prepared),
      ...formatOverview(current, previousOverview, previous),
    };
  }

  async function timeseries(input) {
    const prepared = await prepare(input);
    const rows = await statisticsRepository.timeseries(prepared.query);
    const series = formatTimeseries(rows, prepared.query.groupBy);

    return {
      ...context(prepared),
      groupBy: prepared.query.groupBy,
      totalIncidents: series.reduce(
        (total, item) => total + item.incidentCount,
        0,
      ),
      lastUpdatedAt: latestUpdate(rows),
      series,
    };
  }

  async function hourly(input) {
    const prepared = await prepare(input);
    const rows = await statisticsRepository.hourly(prepared.query);

    return {
      ...context(prepared),
      ...formatHourly(rows),
    };
  }

  async function types(input) {
    const prepared = await prepare(input);
    const rows = await statisticsRepository.types(prepared.query);

    return {
      ...context(prepared),
      ...formatTypes(rows),
    };
  }

  async function hexagon(input) {
    const prepared = await prepare(input);
    const previous = previousQuery(prepared.query);
    const nearbyIndexes = neighboringCells(input.h3Index);
    const [
      current,
      previousOverview,
      timeseriesRows,
      hourlyRows,
      typeRows,
      nearbyRows,
    ] = await Promise.all([
      statisticsRepository.overview(prepared.query),
      statisticsRepository.overview(previous),
      statisticsRepository.timeseries(prepared.query),
      statisticsRepository.hourly(prepared.query),
      statisticsRepository.types(prepared.query),
      statisticsRepository.byHexagons({
        ...prepared.query,
        h3Index: undefined,
        h3Indexes: nearbyIndexes,
      }),
    ]);
    const timeseries = formatTimeseries(
      timeseriesRows,
      prepared.query.groupBy,
    );

    return {
      ...context(prepared),
      overview: formatOverview(current, previousOverview, previous),
      timeseries: {
        groupBy: prepared.query.groupBy,
        totalIncidents: timeseries.reduce(
          (total, item) => total + item.incidentCount,
          0,
        ),
        lastUpdatedAt: latestUpdate(timeseriesRows),
        series: timeseries,
      },
      hourly: formatHourly(hourlyRows),
      types: formatTypes(typeRows),
      nearbyComparison: formatNearbyComparison(
        input.h3Index,
        nearbyIndexes,
        nearbyRows,
      ),
    };
  }

  return Object.freeze({
    overview,
    timeseries,
    hourly,
    types,
    hexagon,
  });
}
