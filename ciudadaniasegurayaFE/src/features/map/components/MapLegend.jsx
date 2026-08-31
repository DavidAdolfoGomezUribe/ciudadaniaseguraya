import { FALLBACK_HEATMAP_SCALE } from "../constants/map.constants";

export function MapLegend({ scale = FALLBACK_HEATMAP_SCALE }) {
  return (
    <div
      className="map-overlay-card absolute bottom-7 left-3 z-10 max-w-[calc(100%-1.5rem)] p-3 sm:left-4"
      aria-label="Leyenda de cantidad de incidentes"
    >
      <p className="technical-label mb-2">REGISTROS VALIDADOS</p>
      <div className="flex flex-wrap gap-x-3 gap-y-2">
        {scale.map((item) => (
          <span key={item.level} className="flex items-center gap-1.5 text-[0.68rem]">
            <span
              aria-hidden="true"
              className="size-3 border border-[var(--border-primary)]"
              style={{ backgroundColor: item.color }}
            />
            <span>
              {item.level === 0
                ? "Sin registros"
                : `${item.min}${item.max === null ? "+" : `–${item.max}`}`}
            </span>
          </span>
        ))}
      </div>
      <p className="mb-0 mt-2 max-w-md text-[0.65rem] text-[var(--foreground-secondary)]">
        Azul indica ausencia de registros validados durante los últimos 12 meses; no es
        una garantía sobre la zona.
      </p>
    </div>
  );
}
