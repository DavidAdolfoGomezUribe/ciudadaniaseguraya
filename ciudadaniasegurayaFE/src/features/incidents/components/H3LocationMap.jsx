"use client";

import { H3HexagonLayer } from "@deck.gl/geo-layers";
import DeckGL from "@deck.gl/react";
import { cellToLatLng, isValidCell, latLngToCell } from "h3-js";
import { useMemo, useState } from "react";
import Map from "react-map-gl/maplibre";

import { COLOMBIA_BOUNDS } from "@/features/map/constants/map.constants";
import { createOpenStreetMapStyle } from "@/features/map/constants/openstreetmap-style";
import { publicEnv } from "@/lib/validation/env.schema";

function cellFor(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const index = latLngToCell(lat, lng, 9);
  return isValidCell(index) ? index : null;
}

export default function H3LocationMap({ latitude, longitude, onChange }) {
  const [viewState, setViewState] = useState(() => ({
    latitude: Number(latitude) || 4.711,
    longitude: Number(longitude) || -74.0721,
    zoom: 11,
    bearing: 0,
    pitch: 0,
  }));
  const selectedH3Index = useMemo(
    () => cellFor(latitude, longitude),
    [latitude, longitude],
  );
  const mapStyle = useMemo(() => createOpenStreetMapStyle(publicEnv.mapTileUrl), []);
  const layers = useMemo(
    () => [
      new H3HexagonLayer({
        id: "report-location-h3",
        data: selectedH3Index ? [{ h3Index: selectedH3Index }] : [],
        getHexagon: (item) => item.h3Index,
        getFillColor: [37, 99, 235, 120],
        getLineColor: [244, 241, 231, 255],
        getLineWidth: 3,
        lineWidthMinPixels: 2,
        filled: true,
        stroked: true,
        pickable: false,
        coverage: 0.94,
      }),
    ],
    [selectedH3Index],
  );

  return (
    <div>
      <p className="mb-2 text-sm text-[var(--foreground-secondary)]">
        Navega y pulsa el mapa para elegir un área H3. Se enviará su punto central
        aproximado; el backend volverá a calcular y validar la celda.
      </p>
      <div
        className="relative h-80 overflow-hidden border border-[var(--border-primary)]"
        aria-label="Selector de ubicación aproximada por hexágono H3"
      >
        <DeckGL
          viewState={viewState}
          controller
          layers={layers}
          onViewStateChange={({ viewState: next }) => setViewState(next)}
          onClick={(info) => {
            const [lng, lat] = info.coordinate || [];
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
            const index = cellFor(lat, lng);
            if (!index) return;
            const [centerLat, centerLng] = cellToLatLng(index);
            onChange({ latitude: centerLat, longitude: centerLng });
          }}
        >
          <Map
            mapStyle={mapStyle}
            minZoom={publicEnv.mapMinZoom}
            maxZoom={publicEnv.mapMaxZoom}
            maxBounds={COLOMBIA_BOUNDS}
            dragRotate={false}
            touchPitch={false}
            attributionControl
          />
        </DeckGL>
      </div>
    </div>
  );
}
