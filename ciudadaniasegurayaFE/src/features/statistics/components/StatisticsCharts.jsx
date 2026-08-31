"use client";

import { useEffect, useMemo } from "react";

import { useMapUiStore } from "@/features/map/state/map-ui.store";
import { rollingYearRange } from "@/features/map/utils/rolling-year";

import { useStatisticsQuery } from "../hooks/useStatistics";
import { fillHours, fillRollingMonths } from "../utils/chart-formatters";
import { ChartPanel } from "./ChartPanel";
import { StatisticsOverview } from "./StatisticsOverview";

export function StatisticsCharts({ onReady }) {
  const cityId = useMapUiStore((state) => state.activeCityId);
  const incidentType = useMapUiStore((state) => state.incidentType);
  const h3Index = useMapUiStore((state) => state.selectedH3Index);
  const range = useMemo(() => rollingYearRange(), []);
  const currentYear = new Date(range.to).getUTCFullYear();
  const baseParams = useMemo(
    () => ({
      cityId,
      h3Index: h3Index || undefined,
      from: range.from,
      to: range.to,
      incidentType: incidentType || undefined,
      timezone: "America/Bogota",
    }),
    [cityId, h3Index, incidentType, range],
  );
  const annual = useStatisticsQuery(
    "year",
    {
      ...baseParams,
      from: new Date(Date.UTC(currentYear - 4, 0, 1)).toISOString(),
      to: range.to,
    },
    Boolean(cityId),
  );
  const overview = useStatisticsQuery("overview", baseParams, Boolean(cityId));
  const monthly = useStatisticsQuery("month", baseParams, Boolean(cityId));
  const daily = useStatisticsQuery("day", baseParams, Boolean(cityId));
  const hourly = useStatisticsQuery("hourly", baseParams, Boolean(cityId));
  const types = useStatisticsQuery("types", baseParams, Boolean(cityId));
  const queriesReady = [overview, annual, monthly, daily, hourly, types].every(
    (query) => !query.isFetching,
  );

  useEffect(() => {
    if (queriesReady) onReady?.();
  }, [onReady, queriesReady]);

  return (
    <div className="chart-grid">
      <StatisticsOverview query={overview} />
      <ChartPanel
        title="INCIDENTES POR AÑO"
        description="Comparación anual de registros validados para el alcance elegido."
        series={annual.data?.series || []}
        status={annual.status}
        error={annual.error}
        type="line"
      />
      <ChartPanel
        title="INCIDENTES POR MES"
        description="Distribución mensual durante los últimos 12 meses."
        series={fillRollingMonths(monthly.data?.series || [], range.to)}
        status={monthly.status}
        error={monthly.error}
      />
      <ChartPanel
        title="INCIDENTES POR DÍA"
        description="Evolución diaria durante los últimos 12 meses."
        series={daily.data?.series || []}
        status={daily.status}
        error={daily.error}
        type="line"
      />
      <ChartPanel
        title="INCIDENTES POR HORA"
        description="Distribución horaria; incluye horas sin registros."
        series={fillHours(hourly.data?.series || [])}
        status={hourly.status}
        error={hourly.error}
      />
      <ChartPanel
        title="DISTRIBUCIÓN POR TIPO"
        description="Comparación directa entre categorías de incidentes."
        series={types.data?.series || []}
        status={types.status}
        error={types.error}
        horizontal
      />
    </div>
  );
}
