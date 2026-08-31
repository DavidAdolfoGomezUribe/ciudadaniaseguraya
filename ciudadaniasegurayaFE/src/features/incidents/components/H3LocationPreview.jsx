"use client";

import { isValidCell, latLngToCell } from "h3-js";
import { useMemo } from "react";

export function H3LocationPreview({ latitude, longitude }) {
  const h3Index = useMemo(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return null;
    }
    const index = latLngToCell(lat, lng, 9);
    return isValidCell(index) ? index : null;
  }, [latitude, longitude]);

  return (
    <div className="border border-[var(--border-soft)] bg-[var(--background-secondary)] p-3">
      <p className="technical-label mb-1">VISTA PREVIA · H3 9</p>
      <p className="mb-0 break-all font-mono text-xs">
        {h3Index || "Selecciona coordenadas válidas"}
      </p>
      <p className="mb-0 mt-2 text-xs text-[var(--foreground-secondary)]">
        Esta referencia es informativa. El backend vuelve a calcular y validar el índice
        antes de aceptar el reporte.
      </p>
    </div>
  );
}
