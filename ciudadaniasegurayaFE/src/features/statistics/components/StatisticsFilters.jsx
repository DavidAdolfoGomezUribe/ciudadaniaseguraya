"use client";

import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { useCities, useIncidentTypes } from "@/features/map/hooks/useCatalogs";
import { useMapUiStore } from "@/features/map/state/map-ui.store";
import { ROLLING_YEAR_LABEL } from "@/features/map/utils/rolling-year";

export function StatisticsFilters() {
  const cities = useCities();
  const types = useIncidentTypes();
  const activeCityId = useMapUiStore((state) => state.activeCityId);
  const activeCityName = useMapUiStore((state) => state.activeCityName);
  const incidentType = useMapUiStore((state) => state.incidentType);
  const selectedH3Index = useMapUiStore((state) => state.selectedH3Index);
  const setActiveCity = useMapUiStore((state) => state.setActiveCity);
  const setIncidentType = useMapUiStore((state) => state.setIncidentType);
  const selectH3 = useMapUiStore((state) => state.selectH3);

  return (
    <div className="system-panel mb-6 grid gap-4 p-4 md:grid-cols-4">
      <label className="grid gap-1 text-sm">
        <span className="technical-label">CIUDAD</span>
        <Select
          value={activeCityId}
          disabled={cities.isPending}
          onChange={(event) => {
            const city = cities.data?.find((item) => item.id === event.target.value);
            if (city) setActiveCity(city.id, city.name);
          }}
        >
          {!activeCityId ? <option value="">Selecciona cobertura</option> : null}
          {cities.data?.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </Select>
      </label>

      <div className="grid gap-1 text-sm">
        <span className="technical-label">PERIODO</span>
        <div
          aria-label="PERIODO"
          className="min-h-11 border border-[var(--border-primary)] bg-[var(--background-elevated)] px-3"
        >
          <span className="flex min-h-11 items-center">{ROLLING_YEAR_LABEL}</span>
        </div>
      </div>

      <label className="grid gap-1 text-sm">
        <span className="technical-label">TIPO DE INCIDENTE</span>
        <Select
          value={incidentType}
          disabled={types.isPending}
          onChange={(event) => setIncidentType(event.target.value)}
        >
          <option value="">Todos los tipos</option>
          {types.data?.map((type) => (
            <option key={type.code} value={type.code}>
              {type.name}
            </option>
          ))}
        </Select>
      </label>

      <div className="grid content-end gap-1">
        <span className="technical-label">ALCANCE</span>
        {selectedH3Index ? (
          <Button variant="secondary" onClick={() => selectH3(null)}>
            VOLVER A {activeCityName.toUpperCase()}
          </Button>
        ) : (
          <div className="flex min-h-11 items-center border border-[var(--border-soft)] px-3 text-sm">
            General · {activeCityName}
          </div>
        )}
      </div>
    </div>
  );
}
