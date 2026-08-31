import { ROLLING_YEAR_LABEL } from "../utils/rolling-year";

export function MapTextSummary({ cells, period, updatedAt }) {
  const total = cells.reduce((sum, cell) => sum + cell.incidentCount, 0);
  const levelCounts = cells.reduce((counts, cell) => {
    counts[cell.level] = (counts[cell.level] || 0) + 1;
    return counts;
  }, {});
  const predominantLevel =
    Object.entries(levelCounts).sort((left, right) => right[1] - left[1])[0]?.[0] ??
    "0";

  return (
    <div className="sr-only" aria-live="polite">
      <h3>Resumen del área visible</h3>
      <p>
        {cells.length} hexágonos visibles, {total} registros validados en total, nivel
        predominante {predominantLevel}, periodo{" "}
        {period === "rolling-year" ? ROLLING_YEAR_LABEL : period}. Última actualización:{" "}
        {updatedAt ? new Date(updatedAt).toLocaleString("es-CO") : "sin datos"}.
      </p>
    </div>
  );
}
