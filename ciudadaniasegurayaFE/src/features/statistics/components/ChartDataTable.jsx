export function ChartDataTable({ title, series }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="min-h-11 cursor-pointer py-3 font-semibold underline">
        Ver datos de {title.toLowerCase()}
      </summary>
      <div className="chart-data-list">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr>
              <th className="px-2 py-2">Periodo o categoría</th>
              <th className="px-2 py-2 text-right">Registros</th>
            </tr>
          </thead>
          <tbody>
            {series.map((item) => (
              <tr key={item.key} className="border-t border-[var(--border-soft)]">
                <td className="px-2 py-2">{item.label || item.key}</td>
                <td className="px-2 py-2 text-right font-mono">{item.incidentCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
