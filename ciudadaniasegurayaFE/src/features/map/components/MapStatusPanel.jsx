import { format } from "date-fns";
import { es } from "date-fns/locale";

import { StatusBadge } from "@/components/ui/StatusBadge";

import { ROLLING_YEAR_LABEL } from "../utils/rolling-year";

export function MapStatusPanel({
  activeCityName,
  resolution,
  period,
  visibleCount,
  isFetching,
  isCached,
  updatedAt,
  connectionStatus,
  resolutionAdjusted,
}) {
  const connection = {
    online: { label: "EN LÍNEA", tone: "success" },
    connecting: { label: "RECONECTANDO", tone: "info" },
    offline: { label: "SIN CONEXIÓN", tone: "warning" },
  }[connectionStatus] || { label: "SIN CONEXIÓN", tone: "warning" };

  return (
    <aside className="map-overlay-card absolute left-3 top-3 z-10 hidden min-w-52 p-3 sm:block">
      <p className="technical-label mb-2">ÁREA VISIBLE</p>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[0.68rem]">
        <dt className="text-[var(--foreground-secondary)]">Cobertura</dt>
        <dd className="m-0 text-right font-semibold">{activeCityName}</dd>
        <dt className="text-[var(--foreground-secondary)]">Resolución H3</dt>
        <dd className="m-0 text-right font-mono">
          {resolution}
          {resolutionAdjusted ? " · AJUSTADA" : ""}
        </dd>
        <dt className="text-[var(--foreground-secondary)]">Periodo</dt>
        <dd className="m-0 text-right font-mono">
          {period === "rolling-year" ? ROLLING_YEAR_LABEL : period}
        </dd>
        <dt className="text-[var(--foreground-secondary)]">Hexágonos</dt>
        <dd className="m-0 text-right font-mono">
          {visibleCount.toLocaleString("es-CO")}
        </dd>
        <dt className="text-[var(--foreground-secondary)]">Consulta</dt>
        <dd className="m-0 text-right">
          {isFetching
            ? "ACTUALIZANDO"
            : isCached
              ? "DATOS EN CACHÉ"
              : updatedAt
                ? format(updatedAt, "HH:mm:ss", { locale: es })
                : "PENDIENTE"}
        </dd>
      </dl>
      <div className="mt-2 flex justify-end">
        <StatusBadge tone={connection.tone}>{connection.label}</StatusBadge>
      </div>
    </aside>
  );
}
