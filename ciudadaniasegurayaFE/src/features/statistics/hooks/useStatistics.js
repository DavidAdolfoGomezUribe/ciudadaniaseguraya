"use client";

import { useQuery } from "@tanstack/react-query";
import { isValidCell } from "h3-js";
import { useMemo } from "react";

import { rollingYearRange } from "@/features/map/utils/rolling-year";
import { queryKeys } from "@/lib/query/query-keys";

import { statisticsService } from "../services/statistics.service";

export function useStatisticsQuery(kind, params, enabled = true) {
  return useQuery({
    queryKey: queryKeys.statistics({ kind, ...params }),
    queryFn: ({ signal }) => {
      if (kind === "overview") {
        return statisticsService.overview(params, { signal });
      }
      if (kind === "hourly") {
        return statisticsService.hourly(params, { signal });
      }
      if (kind === "types") {
        return statisticsService.types(params, { signal });
      }
      return statisticsService.timeseries({ ...params, groupBy: kind }, { signal });
    },
    enabled,
    meta: { persist: true },
  });
}

export function useHexagonStatistics({ cityId, period, h3Index, incidentType }) {
  const range = useMemo(() => rollingYearRange(), []);
  const params = {
    cityId,
    ...range,
    incidentType: incidentType || undefined,
    timezone: "America/Bogota",
    groupBy: "day",
  };

  return useQuery({
    queryKey: queryKeys.statistics({
      kind: "hexagon-detail",
      h3Index,
      period,
      cityId,
      incidentType,
    }),
    queryFn: ({ signal }) => statisticsService.hexagon(h3Index, params, { signal }),
    enabled: Boolean(cityId && h3Index && isValidCell(h3Index)),
    meta: { persist: true },
  });
}
