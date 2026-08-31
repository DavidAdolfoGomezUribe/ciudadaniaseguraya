"use client";

import dynamic from "next/dynamic";
import { LocateFixed, MapPinned } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { Input } from "@/components/ui/Input";
import { publicEnv } from "@/lib/validation/env.schema";

import { H3LocationPreview } from "./H3LocationPreview";

const GoogleLocationMap = dynamic(() => import("./GoogleLocationMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-80 place-items-center border border-[var(--border-primary)]">
      <p className="technical-label pulse-dot">CARGANDO SELECTOR GOOGLE</p>
    </div>
  ),
});

const H3LocationMap = dynamic(() => import("./H3LocationMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-80 place-items-center border border-[var(--border-primary)]">
      <p className="technical-label pulse-dot">PREPARANDO SELECTOR H3</p>
    </div>
  ),
});

export function IncidentLocationPicker({
  latitude,
  longitude,
  address,
  onChange,
  errors,
}) {
  const [method, setMethod] = useState(
    publicEnv.googleMapsApiKey ? "google" : "coordinates",
  );
  const [locationError, setLocationError] = useState(null);

  const requestCurrentLocation = useCallback(() => {
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("Este navegador no ofrece geolocalización.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        onChange({
          latitude: coords.latitude,
          longitude: coords.longitude,
        }),
      (error) => {
        setLocationError(
          error.code === error.PERMISSION_DENIED
            ? "El permiso fue rechazado. Puedes continuar escribiendo coordenadas."
            : "No fue posible obtener la ubicación actual.",
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }, [onChange]);

  return (
    <fieldset className="grid gap-4 border border-[var(--border-primary)] p-4">
      <legend className="px-2 font-semibold">Ubicación del incidente</legend>
      <p className="mb-0 text-sm text-[var(--foreground-secondary)]">
        Selecciona dónde ocurrió el hecho. Tu ubicación actual solo se usa para centrar
        el selector y nunca se envía sin confirmación.
      </p>
      <div className="flex flex-wrap gap-2">
        {publicEnv.googleMapsApiKey ? (
          <Button
            variant={method === "google" ? "primary" : "secondary"}
            onClick={() => setMethod("google")}
          >
            <MapPinned size={16} aria-hidden="true" /> GOOGLE MAPS
          </Button>
        ) : null}
        <Button
          variant={method === "coordinates" ? "primary" : "secondary"}
          onClick={() => setMethod("coordinates")}
        >
          SELECCIÓN APROXIMADA
        </Button>
        <Button variant="secondary" onClick={requestCurrentLocation}>
          <LocateFixed size={16} aria-hidden="true" /> USAR MI POSICIÓN
        </Button>
      </div>

      {locationError ? <ErrorMessage>{locationError}</ErrorMessage> : null}

      {method === "google" ? (
        <GoogleLocationMap
          latitude={Number(latitude) || 4.711}
          longitude={Number(longitude) || -74.0721}
          onChange={onChange}
        />
      ) : (
        <H3LocationMap
          latitude={Number(latitude) || 4.711}
          longitude={Number(longitude) || -74.0721}
          onChange={onChange}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">
          <span>Latitud</span>
          <Input
            type="number"
            inputMode="decimal"
            step="any"
            value={latitude}
            invalid={Boolean(errors?.latitude)}
            onChange={(event) => onChange({ latitude: event.target.value, longitude })}
          />
          {errors?.latitude ? (
            <span className="text-[var(--accent-warning)]">
              {errors.latitude.message}
            </span>
          ) : null}
        </label>
        <label className="grid gap-1 text-sm">
          <span>Longitud</span>
          <Input
            type="number"
            inputMode="decimal"
            step="any"
            value={longitude}
            invalid={Boolean(errors?.longitude)}
            onChange={(event) => onChange({ latitude, longitude: event.target.value })}
          />
          {errors?.longitude ? (
            <span className="text-[var(--accent-warning)]">
              {errors.longitude.message}
            </span>
          ) : null}
        </label>
      </div>

      <label className="grid gap-1 text-sm">
        <span>Dirección aproximada</span>
        <Input
          value={address}
          maxLength={200}
          onChange={(event) => onChange({ address: event.target.value })}
        />
      </label>
      <H3LocationPreview latitude={latitude} longitude={longitude} />
    </fieldset>
  );
}
