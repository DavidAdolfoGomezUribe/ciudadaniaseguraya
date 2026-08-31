"use client";

import {
  AdvancedMarker,
  APIProvider,
  Map,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { useEffect, useRef } from "react";

import { Input } from "@/components/ui/Input";
import { publicEnv } from "@/lib/validation/env.schema";

function PlacesSearch({ onSelect }) {
  const inputRef = useRef(null);
  const places = useMapsLibrary("places");

  useEffect(() => {
    if (!places || !inputRef.current) return undefined;
    const autocomplete = new places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "co" },
      fields: ["formatted_address", "geometry", "name"],
    });
    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const location = place.geometry?.location;
      if (!location) return;
      onSelect({
        latitude: location.lat(),
        longitude: location.lng(),
        address: place.formatted_address || place.name || "",
      });
    });
    return () => listener.remove();
  }, [onSelect, places]);

  return (
    <label className="grid gap-1 text-sm">
      <span className="technical-label">BUSCAR DIRECCIÓN O LUGAR</span>
      <Input
        ref={inputRef}
        type="search"
        placeholder="Ej. Parque Nacional, Bogotá"
        autoComplete="off"
      />
    </label>
  );
}

function MapContent({ latitude, longitude, onChange }) {
  const position = { lat: latitude, lng: longitude };
  return (
    <>
      <PlacesSearch onSelect={onChange} />
      <div className="mt-3 h-80 overflow-hidden border border-[var(--border-primary)]">
        <Map
          defaultCenter={position}
          center={position}
          defaultZoom={14}
          mapId="DEMO_MAP_ID"
          gestureHandling="greedy"
          disableDefaultUI={false}
          restriction={{
            latLngBounds: {
              north: 13.7,
              south: -4.6,
              east: -66.5,
              west: -79.2,
            },
            strictBounds: true,
          }}
          onClick={(event) => {
            const point = event.detail.latLng;
            if (point) {
              onChange({ latitude: point.lat, longitude: point.lng });
            }
          }}
        >
          <AdvancedMarker
            position={position}
            draggable
            onDragEnd={(event) => {
              const point = event.latLng;
              if (point) {
                onChange({
                  latitude: point.lat(),
                  longitude: point.lng(),
                });
              }
            }}
          />
        </Map>
      </div>
    </>
  );
}

export default function GoogleLocationMap(props) {
  return (
    <APIProvider
      apiKey={publicEnv.googleMapsApiKey}
      libraries={["places", "marker"]}
      language="es"
      region="CO"
    >
      <MapContent {...props} />
    </APIProvider>
  );
}
