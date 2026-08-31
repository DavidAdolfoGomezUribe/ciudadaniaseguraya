import { seriesSummary } from "../utils/chart-formatters";

export function ChartDataSummary({ series, unit = "registros" }) {
  const summary = seriesSummary(series);

  return (
    <p className="mb-3 text-sm text-[var(--foreground-secondary)]">
      Total: <strong>{summary.total}</strong> {unit}.{" "}
      {summary.maximum ? (
        <>
          Mayor valor: <strong>{summary.maximum.label || summary.maximum.key}</strong> (
          {summary.maximum.incidentCount}). Promedio:{" "}
          <strong>{summary.average.toFixed(1)}</strong>.
        </>
      ) : (
        "No hay valores disponibles para el alcance seleccionado."
      )}
    </p>
  );
}
