"use client";

import { useQuery } from "@tanstack/react-query";
import { isValidCell } from "h3-js";

import { queryKeys } from "@/lib/query/query-keys";

import { heatmapService } from "../services/heatmap.service";

export function useSelectedHexagon({ cityId, period, h3Index }) {
  return useQuery({
    queryKey: queryKeys.hexagon({ cityId, period, h3Index }),
    queryFn: ({ signal }) => heatmapService.hexagon(h3Index, { cityId }, { signal }),
    enabled: Boolean(cityId && h3Index && isValidCell(h3Index)),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    meta: { persist: true },
  });
}
