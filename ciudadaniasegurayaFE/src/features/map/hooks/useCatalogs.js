"use client";

import { useQuery } from "@tanstack/react-query";

import { catalogService } from "@/features/catalog/services/catalog.service";
import { PUBLIC_GC_TIME } from "@/lib/query/query-client";
import { queryKeys } from "@/lib/query/query-keys";

import { heatmapService } from "../services/heatmap.service";

export function useCities() {
  return useQuery({
    queryKey: queryKeys.cities,
    queryFn: ({ signal }) => heatmapService.cities({ signal }),
    staleTime: PUBLIC_GC_TIME,
    meta: { persist: true },
  });
}

export function useIncidentTypes() {
  return useQuery({
    queryKey: queryKeys.incidentTypes,
    queryFn: ({ signal }) => catalogService.incidentTypes({ signal }),
    staleTime: PUBLIC_GC_TIME,
    meta: { persist: true },
  });
}

export function useMapConfiguration() {
  return useQuery({
    queryKey: queryKeys.mapConfig,
    queryFn: ({ signal }) => heatmapService.configuration({ signal }),
    staleTime: PUBLIC_GC_TIME,
    meta: { persist: true },
    retry: 1,
  });
}
