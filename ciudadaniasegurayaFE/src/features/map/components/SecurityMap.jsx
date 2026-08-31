"use client";

import { isValidCell } from "h3-js";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { publicEnv } from "@/lib/validation/env.schema";
import { useRealtimeUiStore } from "@/features/realtime/state/realtime-ui.store";

import {
  DEFAULT_H3_SUPPORTED_RESOLUTIONS,
  FALLBACK_HEATMAP_SCALE,
} from "../constants/map.constants";
import { useCities, useMapConfiguration } from "../hooks/useCatalogs";
import { useHeatmap } from "../hooks/useHeatmap";
import { useVisibleHexagons } from "../hooks/useVisibleHexagons";
import { useMapUiStore } from "../state/map-ui.store";
import { mergeHeatmapData } from "../utils/merge-heatmap-data";
import { MapCanvas } from "./MapCanvas";
import { WebGLFallback } from "./WebGLFallback";

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function SecurityMap({ onReady }) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [mapStatus, setMapStatus] = useState("loading");
  const [webglSupported] = useState(() =>
    typeof document === "undefined" ? true : supportsWebGL(),
  );
  const cities = useCities();
  const mapConfig = useMapConfiguration();
  const activeCityId = useMapUiStore((state) => state.activeCityId);
  const committedBounds = useMapUiStore((state) => state.committedBounds);
  const resolution = useMapUiStore((state) => state.resolution);
  const period = useMapUiStore((state) => state.period);
  const incidentType = useMapUiStore((state) => state.incidentType);
  const visibleH3Indexes = useMapUiStore((state) => state.visibleH3Indexes);
  const gridStatus = useMapUiStore((state) => state.gridStatus);
  const gridError = useMapUiStore((state) => state.gridError);
  const setActiveCity = useMapUiStore((state) => state.setActiveCity);
  const selectH3 = useMapUiStore((state) => state.selectH3);
  const connectionStatus = useRealtimeUiStore((state) => state.status);

  const activeCity = useMemo(
    () => cities.data?.find((city) => city.id === activeCityId),
    [activeCityId, cities.data],
  );

  useEffect(() => {
    if (!cities.data?.length || activeCityId) return;
    const preferred =
      cities.data.find((city) => city.id === publicEnv.defaultCityId) ||
      cities.data.find((city) => city.slug === publicEnv.defaultCitySlug) ||
      cities.data[0];
    setActiveCity(preferred.id, preferred.name);
  }, [activeCityId, cities.data, setActiveCity]);

  useEffect(() => {
    const h3Index = searchParams.get("hex");
    if (h3Index && isValidCell(h3Index)) selectH3(h3Index);
    if (
      (h3Index || searchParams.has("period")) &&
      searchParams.get("period") !== period
    ) {
      const next = new URLSearchParams(searchParams.toString());
      next.set("period", period);
      window.history.replaceState(
        window.history.state,
        "",
        `${pathname}?${next.toString()}`,
      );
    }
  }, [pathname, period, searchParams, selectH3]);

  const supportedResolutions =
    mapConfig.data?.h3SupportedResolutions || DEFAULT_H3_SUPPORTED_RESOLUTIONS;
  const grid = useVisibleHexagons({ supportedResolutions });
  const heatmap = useHeatmap({
    cityId: activeCityId,
    period,
    resolution,
    bounds: committedBounds,
    incidentType,
  });
  const cells = useMemo(
    () => mergeHeatmapData([...visibleH3Indexes], heatmap.data || [], period),
    [heatmap.data, period, visibleH3Indexes],
  );

  const markMapLoaded = useCallback(() => setMapStatus("ready"), []);
  const markMapError = useCallback(
    () => setMapStatus((current) => (current === "ready" ? current : "error")),
    [],
  );

  useEffect(() => {
    if (mapStatus !== "loading") onReady?.();
  }, [mapStatus, onReady]);

  useEffect(() => {
    if (!webglSupported) onReady?.();
  }, [onReady, webglSupported]);

  if (!webglSupported) {
    return <WebGLFallback />;
  }

  const boundary = grid.boundary || null;

  return (
    <div className="landing-map-content relative h-full">
      {gridError ? (
        <div className="absolute left-1/2 top-4 z-30 w-[min(90%,34rem)] -translate-x-1/2">
          <ErrorMessage>{gridError}</ErrorMessage>
        </div>
      ) : null}
      {mapStatus === "error" ? (
        <div className="absolute left-1/2 top-4 z-30 w-[min(90%,34rem)] -translate-x-1/2">
          <ErrorMessage>
            No fue posible cargar una tesela de calles. El mapa H3 continúa disponible y
            volverá a solicitar cartografía al navegar.
          </ErrorMessage>
        </div>
      ) : null}
      {heatmap.error ? (
        <div className="absolute left-1/2 top-4 z-30 w-[min(90%,34rem)] -translate-x-1/2">
          <ErrorMessage requestId={heatmap.error.requestId}>
            {heatmap.data
              ? "Mostrando datos guardados. No fue posible sincronizar el mapa."
              : "No fue posible sincronizar los datos. La cuadrícula muestra cero registros, sin datos simulados."}
          </ErrorMessage>
        </div>
      ) : null}
      <MapCanvas
        cells={cells}
        boundary={boundary}
        cityId={activeCityId}
        activeCityName={activeCity?.name || "Cobertura por confirmar"}
        query={heatmap}
        scale={mapConfig.data?.heatmapScale || FALLBACK_HEATMAP_SCALE}
        connectionStatus={connectionStatus}
        onMapLoaded={markMapLoaded}
        onMapError={markMapError}
      />
    </div>
  );
}
