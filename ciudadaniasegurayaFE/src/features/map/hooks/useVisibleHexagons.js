"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef } from "react";

import { publicEnv } from "@/lib/validation/env.schema";

import { DEFAULT_H3_SUPPORTED_RESOLUTIONS } from "../constants/map.constants";
import { useMapUiStore } from "../state/map-ui.store";
import { normalizeBounds } from "../utils/viewport-key";

function useColombiaBoundary() {
  return useQuery({
    queryKey: ["boundary", "colombia", "natural-earth-110m"],
    queryFn: async ({ signal }) => {
      const response = await fetch("/data/colombia-boundary-simplified.geojson", {
        signal,
      });
      if (!response.ok) throw new Error("No se pudo cargar el límite de Colombia");
      return response.json();
    },
    staleTime: Infinity,
    gcTime: Infinity,
    meta: { persist: true },
  });
}

export function useVisibleHexagons({
  coverageBoundary = null,
  supportedResolutions = DEFAULT_H3_SUPPORTED_RESOLUTIONS,
} = {}) {
  const workerRef = useRef(null);
  const requestIdRef = useRef(0);
  const committedBounds = useMapUiStore((state) => state.committedBounds);
  const requestedResolution = useMapUiStore((state) => state.requestedResolution);
  const setGrid = useMapUiStore((state) => state.setGrid);
  const setGridStatus = useMapUiStore((state) => state.setGridStatus);
  const colombiaBoundary = useColombiaBoundary();

  const geometry = useMemo(
    () => coverageBoundary || colombiaBoundary.data?.features?.[0]?.geometry || null,
    [coverageBoundary, colombiaBoundary.data],
  );

  useEffect(() => {
    if (typeof Worker === "undefined") {
      setGridStatus(
        "error",
        "El navegador no permite ejecutar el generador geoespacial.",
      );
      return undefined;
    }

    const worker = new Worker(
      new URL("../workers/h3-grid.worker.js", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;
    worker.onmessage = ({ data }) => {
      if (data.id !== requestIdRef.current) return;
      if (!data.ok) {
        setGridStatus("error", data.message);
        return;
      }
      setGrid(data);
    };
    worker.onerror = () =>
      setGridStatus("error", "No fue posible generar la cuadrícula visible.");

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, [setGrid, setGridStatus]);

  useEffect(() => {
    if (!workerRef.current || !geometry) return;
    requestIdRef.current += 1;
    setGridStatus("loading");
    workerRef.current.postMessage({
      id: requestIdRef.current,
      bounds: normalizeBounds(committedBounds, 0, 5),
      requestedResolution,
      supportedResolutions,
      boundary: geometry,
      maxCells: publicEnv.maxVisibleH3Cells,
    });
  }, [
    committedBounds,
    geometry,
    requestedResolution,
    setGridStatus,
    supportedResolutions,
  ]);

  return {
    boundary: colombiaBoundary.data,
    boundaryError: colombiaBoundary.error,
    boundaryLoading: colombiaBoundary.isPending,
  };
}
