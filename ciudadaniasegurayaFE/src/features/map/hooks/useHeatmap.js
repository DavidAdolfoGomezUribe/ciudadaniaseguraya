"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query/query-keys";

import { heatmapService } from "../services/heatmap.service";
import { normalizeBounds, intersectsColombia } from "../utils/viewport-key";

export function useHeatmap({ cityId, period, resolution, bounds, incidentType }) {
  const normalized = normalizeBounds(bounds);
  return useQuery({
    queryKey: queryKeys.heatmap({
      cityId,
      period,
      resolution,
      bounds: normalized,
      incidentType,
    }),
    queryFn: ({ signal }) =>
      heatmapService.heatmap(
        {
          cityId,
          resolution,
          ...normalized,
          incidentType: incidentType || undefined,
        },
        { signal },
      ),
    enabled: Boolean(cityId) && intersectsColombia(normalized),
    placeholderData: keepPreviousData,
    refetchInterval: 10 * 60 * 1_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    meta: { persist: true },
  });
}
