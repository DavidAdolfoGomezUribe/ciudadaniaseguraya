"use client";

import dynamic from "next/dynamic";

import { QueryRestoreGate } from "@/components/feedback/QueryRestoreGate";
import { useMapUiStore } from "@/features/map/state/map-ui.store";

import { StatisticsFilters } from "./StatisticsFilters";

function StatisticsLoading() {
  return (
    <div className="system-panel grid min-h-72 place-items-center" role="status">
      <p className="technical-label pulse-dot">PREPARANDO GRÁFICAS</p>
    </div>
  );
}

const StatisticsCharts = dynamic(
  () => import("./StatisticsCharts").then((module) => module.StatisticsCharts),
  {
    ssr: false,
    loading: StatisticsLoading,
  },
);

export function StatisticsSection({ onReady }) {
  const selectedH3Index = useMapUiStore((state) => state.selectedH3Index);

  return (
    <section id="estadisticas" className="page-grid py-16 sm:py-20">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="technical-label mb-2">ANÁLISIS · DATOS AGREGADOS</p>
          <h2 className="mb-2 text-3xl font-semibold sm:text-4xl">
            {selectedH3Index
              ? "ESTADÍSTICAS DEL HEXÁGONO"
              : "ESTADÍSTICAS DE INCIDENTES"}
          </h2>
          {selectedH3Index ? (
            <p className="mb-0 break-all font-mono text-sm">
              {selectedH3Index.toUpperCase()}
            </p>
          ) : (
            <p className="mb-0 max-w-2xl text-[var(--foreground-secondary)]">
              Agregaciones calculadas en el backend; la aplicación no descarga
              incidentes individuales para reconstruir estas series.
            </p>
          )}
        </div>
      </div>
      <QueryRestoreGate fallback={<StatisticsLoading />}>
        <StatisticsFilters />
        <StatisticsCharts onReady={onReady} />
      </QueryRestoreGate>
    </section>
  );
}
