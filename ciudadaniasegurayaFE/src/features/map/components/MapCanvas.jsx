"use client";

import DeckGL from "@deck.gl/react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef } from "react";
import Map from "react-map-gl/maplibre";

import { publicEnv } from "@/lib/validation/env.schema";

import { MAP_MOVE_DEBOUNCE_MS } from "../constants/map.constants";
import { createOpenStreetMapStyle } from "../constants/openstreetmap-style";
import { createBoundaryLayer } from "../layers/createBoundaryLayer";
import { createH3Layer } from "../layers/createH3Layer";
import { useMapUiStore } from "../state/map-ui.store";
import { mapControllerOptions } from "../utils/map-controller-options";
import { HexagonDetailsPanel } from "./HexagonDetailsPanel";
import { HexagonTooltip } from "./HexagonTooltip";
import { MapActivationOverlay } from "./MapActivationOverlay";
import { MapControls } from "./MapControls";
import { MapLegend } from "./MapLegend";
import { MapStatusPanel } from "./MapStatusPanel";
import { MapTextSummary } from "./MapTextSummary";
import { MapNotificationPanel } from "@/features/realtime/components/MapNotificationPanel";

export function MapCanvas({
  cells,
  boundary,
  cityId,
  activeCityName,
  query,
  scale,
  connectionStatus,
  onMapLoaded,
  onMapError,
}) {
  const mapRef = useRef(null);
  const commitTimerRef = useRef(null);
  const resetFrameRef = useRef(null);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activated = useMapUiStore((state) => state.activated);
  const viewport = useMapUiStore((state) => state.viewport);
  const resolution = useMapUiStore((state) => state.resolution);
  const resolutionAdjusted = useMapUiStore((state) => state.resolutionAdjusted);
  const selectedH3Index = useMapUiStore((state) => state.selectedH3Index);
  const hoveredCell = useMapUiStore((state) => state.hoveredCell);
  const period = useMapUiStore((state) => state.period);
  const activate = useMapUiStore((state) => state.activate);
  const deactivate = useMapUiStore((state) => state.deactivate);
  const setViewport = useMapUiStore((state) => state.setViewport);
  const resetViewport = useMapUiStore((state) => state.resetViewport);
  const commitBounds = useMapUiStore((state) => state.commitBounds);
  const selectH3 = useMapUiStore((state) => state.selectH3);
  const hoverCell = useMapUiStore((state) => state.hoverCell);

  const updateSelection = useCallback(
    (h3Index) => {
      selectH3(h3Index);
      const next = new URLSearchParams(searchParams.toString());
      if (h3Index) next.set("hex", h3Index);
      else next.delete("hex");
      next.set("period", period);
      window.history.replaceState(
        window.history.state,
        "",
        `${pathname}?${next.toString()}`,
      );
    },
    [pathname, period, searchParams, selectH3],
  );

  useEffect(() => {
    const sharedPeriod = searchParams.get("period");
    if (sharedPeriod === period) return;
    if (!selectedH3Index && !sharedPeriod) return;

    const next = new URLSearchParams(searchParams.toString());
    next.set("period", period);
    window.history.replaceState(
      window.history.state,
      "",
      `${pathname}?${next.toString()}`,
    );
  }, [pathname, period, searchParams, selectedH3Index]);

  const layers = useMemo(
    () => [
      ...(boundary ? [createBoundaryLayer(boundary)] : []),
      createH3Layer({
        cells,
        selectedH3Index,
        interactive: activated,
        onHover: (info) => hoverCell(info.object ? info : null),
        onClick: (info) => {
          if (info.object) updateSelection(info.object.h3Index);
        },
      }),
    ],
    [activated, boundary, cells, hoverCell, selectedH3Index, updateSelection],
  );
  const mapStyle = useMemo(() => createOpenStreetMapStyle(publicEnv.mapTileUrl), []);
  const controller = useMemo(
    () =>
      mapControllerOptions({
        activated,
        minZoom: publicEnv.mapMinZoom,
        maxZoom: publicEnv.mapMaxZoom,
      }),
    [activated],
  );

  const commitVisibleBounds = useCallback(() => {
    const bounds = mapRef.current?.getBounds();
    if (!bounds) return;
    commitBounds({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    });
  }, [commitBounds]);

  const handleViewStateChange = useCallback(
    ({ viewState }) => {
      setViewport(viewState);
      clearTimeout(commitTimerRef.current);
      commitTimerRef.current = setTimeout(commitVisibleBounds, MAP_MOVE_DEBOUNCE_MS);
    },
    [commitVisibleBounds, setViewport],
  );

  const handleReset = useCallback(() => {
    clearTimeout(commitTimerRef.current);
    resetViewport();
    cancelAnimationFrame(resetFrameRef.current);
    resetFrameRef.current = requestAnimationFrame(() => {
      resetFrameRef.current = requestAnimationFrame(commitVisibleBounds);
    });
  }, [commitVisibleBounds, resetViewport]);

  useEffect(
    () => () => {
      clearTimeout(commitTimerRef.current);
      cancelAnimationFrame(resetFrameRef.current);
    },
    [],
  );

  return (
    <div className="map-shell" aria-label="Mapa interactivo de Bogotá">
      <DeckGL
        viewState={viewport}
        controller={controller}
        layers={layers}
        onViewStateChange={handleViewStateChange}
      >
        <Map
          ref={mapRef}
          mapStyle={mapStyle}
          minZoom={publicEnv.mapMinZoom}
          maxZoom={publicEnv.mapMaxZoom}
          dragRotate={false}
          touchPitch={false}
          cooperativeGestures={!activated}
          reuseMaps
          onLoad={() => {
            commitVisibleBounds();
            onMapLoaded?.();
          }}
          onError={onMapError}
          attributionControl
        />
      </DeckGL>

      {!activated ? <MapActivationOverlay onActivate={activate} /> : null}
      <MapControls
        activated={activated}
        onDeactivate={deactivate}
        onReset={handleReset}
      />
      <MapStatusPanel
        activeCityName={activeCityName}
        resolution={resolution}
        period={period}
        visibleCount={cells.length}
        isFetching={query.isFetching}
        isCached={query.isPlaceholderData}
        updatedAt={query.dataUpdatedAt || null}
        connectionStatus={connectionStatus}
        resolutionAdjusted={resolutionAdjusted}
      />
      <MapLegend scale={scale} />
      <MapNotificationPanel />
      <HexagonTooltip info={activated ? hoveredCell : null} />
      <HexagonDetailsPanel
        cityId={cityId}
        cityName={activeCityName}
        period={period}
        h3Index={selectedH3Index}
        onClose={() => updateSelection(null)}
      />
      <MapTextSummary cells={cells} period={period} updatedAt={query.dataUpdatedAt} />
    </div>
  );
}
