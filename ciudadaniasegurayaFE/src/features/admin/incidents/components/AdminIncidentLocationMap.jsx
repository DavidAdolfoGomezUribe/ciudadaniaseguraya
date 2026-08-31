"use client";

import { H3HexagonLayer } from "@deck.gl/geo-layers";
import DeckGL from "@deck.gl/react";
import { isValidCell, latLngToCell } from "h3-js";
import { useMemo, useState } from "react";
import Map from "react-map-gl/maplibre";

import { createOpenStreetMapStyle } from "@/features/map/constants/openstreetmap-style";
import { publicEnv } from "@/lib/validation/env.schema";

export default function AdminIncidentLocationMap({ latitude, longitude, h3Index }) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const validCoordinates = Number.isFinite(lat) && Number.isFinite(lng);
  const selectedH3Index = useMemo(() => {
    if (h3Index && isValidCell(h3Index)) return h3Index;
    if (!validCoordinates) return null;
    const calculated = latLngToCell(lat, lng, 9);
    return isValidCell(calculated) ? calculated : null;
  }, [h3Index, lat, lng, validCoordinates]);
  const [viewState, setViewState] = useState({
    latitude: validCoordinates ? lat : 4.711,
    longitude: validCoordinates ? lng : -74.0721,
    zoom: 13,
    bearing: 0,
    pitch: 0,
  });
  const mapStyle = useMemo(() => createOpenStreetMapStyle(publicEnv.mapTileUrl), []);
  const layers = useMemo(
    () => [
      new H3HexagonLayer({
        id: "admin-incident-location",
        data: selectedH3Index ? [{ h3Index: selectedH3Index }] : [],
        getHexagon: (item) => item.h3Index,
        getFillColor: [147, 68, 58, 105],
        getLineColor: [39, 22, 14, 255],
        getLineWidth: 4,
        lineWidthMinPixels: 2,
        filled: true,
        stroked: true,
        pickable: false,
        coverage: 1,
      }),
    ],
    [selectedH3Index],
  );

  return (
    <div
      className="relative h-80 overflow-hidden border border-[var(--border-primary)]"
      aria-label="Mapa de ubicación del incidente"
    >
      <DeckGL
        viewState={viewState}
        controller
        layers={layers}
        onViewStateChange={({ viewState: next }) => setViewState(next)}
      >
        <Map
          mapStyle={mapStyle}
          minZoom={publicEnv.mapMinZoom}
          maxZoom={publicEnv.mapMaxZoom}
          dragRotate={false}
          touchPitch={false}
          attributionControl
        />
      </DeckGL>
    </div>
  );
}
