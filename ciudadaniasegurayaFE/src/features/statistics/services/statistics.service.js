import { apiRequest } from "@/lib/api/api-client";
import { endpoints } from "@/lib/api/endpoints";

import {
  hexagonStatisticsSchema,
  seriesResponseSchema,
} from "../schemas/statistics.schema";

function queryString(params) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  });
  return search.toString();
}

async function requestSeries(endpoint, params, signal) {
  const result = await apiRequest(`${endpoint}?${queryString(params)}`, {
    signal,
  });
  return seriesResponseSchema.parse(result.data);
}

export const statisticsService = Object.freeze({
  overview(params, { signal } = {}) {
    return requestSeries(endpoints.statistics.overview, params, signal);
  },
  timeseries(params, { signal } = {}) {
    return requestSeries(endpoints.statistics.timeseries, params, signal);
  },
  hourly(params, { signal } = {}) {
    return requestSeries(endpoints.statistics.hourly, params, signal);
  },
  types(params, { signal } = {}) {
    return requestSeries(endpoints.statistics.types, params, signal);
  },
  hexagon(h3Index, params, { signal } = {}) {
    return apiRequest(
      `${endpoints.geolocation.hexagonStatistics(h3Index)}?${queryString(params)}`,
      { signal },
    ).then((result) => hexagonStatisticsSchema.parse(result.data));
  },
});
