"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useHexagonStatistics } from "@/features/statistics/hooks/useStatistics";
import { safeExternalUrl } from "@/lib/security/external-url";

import { useSelectedHexagon } from "../hooks/useSelectedHexagon";
import { useMapUiStore } from "../state/map-ui.store";
import { predominantType } from "../utils/hexagon-colors";
import { ROLLING_YEAR_LABEL } from "../utils/rolling-year";

function hourList(hours) {
  if (!hours?.length) return "No disponible";
  return hours.map((hour) => `${String(hour).padStart(2, "0")}:00`).join(", ");
}

export function HexagonDetailsPanel({ cityId, cityName, period, h3Index, onClose }) {
  const detail = useSelectedHexagon({ cityId, period, h3Index });
  const incidentType = useMapUiStore((state) => state.incidentType);
  const aggregates = useHexagonStatistics({
    cityId,
    period,
    h3Index,
    incidentType,
  });

  useEffect(() => {
    if (!h3Index) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [h3Index, onClose]);

  if (!h3Index) return null;

  const statistics = detail.data?.statistics;
  const overview = aggregates.data?.overview;
  const hourly = aggregates.data?.hourly;
  const comparison = overview?.comparison;
  const nearby = aggregates.data?.nearbyComparison;

  return (
    <aside
      aria-label="Detalles del hexágono seleccionado"
      className="map-overlay-card absolute bottom-0 right-0 top-auto z-20 max-h-[72%] w-full overflow-auto p-5 md:bottom-3 md:right-3 md:top-3 md:max-h-none md:w-80"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="technical-label mb-1">SELECCIÓN · H3</p>
          <h3 className="mb-0 break-all font-mono text-sm">{h3Index}</h3>
        </div>
        <Button
          variant="ghost"
          className="size-11 px-0"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          aria-label="Cerrar detalles"
        >
          <X size={18} aria-hidden="true" />
        </Button>
      </div>

      {detail.isPending ? (
        <p role="status" className="technical-label pulse-dot">
          CARGANDO DETALLE
        </p>
      ) : detail.error ? (
        <ErrorMessage requestId={detail.error.requestId}>
          {detail.error.message}
        </ErrorMessage>
      ) : (
        <>
          <StatusBadge tone={statistics ? "info" : "neutral"}>
            {statistics ? "DATOS DISPONIBLES" : "SIN REGISTROS VALIDADOS"}
          </StatusBadge>
          <dl className="mt-5 grid grid-cols-[1fr_auto] gap-x-3 gap-y-3 text-sm">
            <dt>Ciudad</dt>
            <dd className="m-0 text-right">{cityName || "Cobertura activa"}</dd>
            <dt>Barrio aproximado</dt>
            <dd className="m-0 text-right">No disponible</dd>
            <dt>Periodo</dt>
            <dd className="m-0 text-right">{ROLLING_YEAR_LABEL}</dd>
            <dt>Total validado</dt>
            <dd className="m-0 font-mono">{statistics?.incidentCount ?? 0}</dd>
            <dt>Nivel</dt>
            <dd className="m-0 font-mono">{statistics?.level ?? 0}</dd>
            <dt>Categoría principal</dt>
            <dd className="m-0 text-right">
              {predominantType(statistics?.incidentTypes)}
            </dd>
            <dt>Última actualización</dt>
            <dd className="m-0 text-right text-xs">
              {statistics?.lastUpdatedAt
                ? new Date(statistics.lastUpdatedAt).toLocaleString("es-CO")
                : overview?.lastUpdatedAt
                  ? new Date(overview.lastUpdatedAt).toLocaleString("es-CO")
                  : "No disponible"}
            </dd>
          </dl>
          <div className="mt-5 border-t border-[var(--border-soft)] pt-4">
            <p className="technical-label mb-2">COMPARACIÓN Y HORARIOS</p>
            {aggregates.isPending ? (
              <p role="status" className="text-sm">
                Consultando estadísticas detalladas…
              </p>
            ) : aggregates.error ? (
              <ErrorMessage requestId={aggregates.error.requestId}>
                Las comparaciones no están disponibles en este momento.
              </ErrorMessage>
            ) : (
              <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-2 text-sm">
                <dt>Periodo anterior</dt>
                <dd className="m-0 text-right font-mono">
                  {comparison?.previousIncidentCount ?? 0}
                </dd>
                <dt>Variación</dt>
                <dd className="m-0 text-right font-mono">
                  {comparison?.percentageChange == null
                    ? "Sin base comparable"
                    : `${comparison.percentageChange > 0 ? "+" : ""}${comparison.percentageChange}%`}
                </dd>
                <dt>Horas con mayor cantidad</dt>
                <dd className="m-0 max-w-36 text-right font-mono">
                  {hourList(hourly?.summary?.busiestHours)}
                </dd>
                <dt>Horas con menor cantidad</dt>
                <dd className="m-0 max-w-36 text-right font-mono">
                  {hourList(hourly?.summary?.quietestHours)}
                </dd>
                <dt>Validación comunitaria</dt>
                <dd className="m-0 text-right font-mono">
                  {overview?.validation?.communityConfirmed ?? 0}
                </dd>
                <dt>Validación administrativa</dt>
                <dd className="m-0 text-right font-mono">
                  {overview?.validation?.adminVerified ?? 0}
                </dd>
                <dt>Promedio de hexágonos vecinos</dt>
                <dd className="m-0 text-right font-mono">
                  {nearby?.averageNeighborCount ?? 0}
                </dd>
                <dt>Diferencia frente a vecinos</dt>
                <dd className="m-0 text-right font-mono">
                  {nearby
                    ? `${nearby.absoluteDifference > 0 ? "+" : ""}${nearby.absoluteDifference}`
                    : "No disponible"}
                </dd>
              </dl>
            )}
          </div>
          <div className="mt-5 border-t border-[var(--border-soft)] pt-4">
            <p className="technical-label mb-2">TIPOS DE INCIDENTE</p>
            {Object.keys(statistics?.incidentTypes || {}).length ? (
              <ul className="m-0 grid gap-1 p-0">
                {Object.entries(statistics.incidentTypes).map(([type, count]) => (
                  <li key={type} className="flex justify-between gap-3 text-sm">
                    <span>{type.replaceAll("_", " ")}</span>
                    <strong className="font-mono">{count}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--foreground-secondary)]">
                No hay distribución disponible para los últimos 12 meses.
              </p>
            )}
          </div>
          <div className="mt-5 border-t border-[var(--border-soft)] pt-4">
            <p className="technical-label mb-2">INCIDENTES PÚBLICOS</p>
            {detail.data?.incidents?.length ? (
              <ul className="m-0 grid gap-3 p-0">
                {detail.data.incidents.slice(0, 5).map((incident) => (
                  <li
                    key={incident.id}
                    className="border-l-2 border-[var(--border-soft)] pl-3 text-sm"
                  >
                    <p className="mb-1 font-semibold">{incident.title}</p>
                    <p className="mb-1 text-xs text-[var(--foreground-secondary)]">
                      {new Date(incident.occurredAt).toLocaleDateString("es-CO")} ·{" "}
                      {incident.verification?.method === "administrative"
                        ? "Validación administrativa"
                        : "Validación comunitaria"}
                    </p>
                    {(incident.sourceUrls || []).map((value) => {
                      const url = safeExternalUrl(value);
                      return url ? (
                        <a
                          key={url.href}
                          className="text-xs underline"
                          href={url.href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Fuente externa · {url.hostname}
                        </a>
                      ) : null;
                    })}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--foreground-secondary)]">
                No hay incidentes públicos asociados a los últimos 12 meses.
              </p>
            )}
          </div>
          <p className="mt-5 border-t border-[var(--border-soft)] pt-4 text-xs text-[var(--foreground-secondary)]">
            La validación comunitaria expresa coincidencia entre reportes; no equivale a
            una confirmación oficial.
          </p>
        </>
      )}
    </aside>
  );
}
