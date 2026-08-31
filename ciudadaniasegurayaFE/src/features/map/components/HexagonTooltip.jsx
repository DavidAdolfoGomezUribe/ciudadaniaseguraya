import { predominantType } from "../utils/hexagon-colors";
import { ROLLING_YEAR_LABEL } from "../utils/rolling-year";

export function HexagonTooltip({ info }) {
  if (!info?.object) return null;
  const cell = info.object;

  return (
    <div
      className="pointer-events-none fixed z-[80] max-w-72 border border-[var(--foreground-primary)] bg-[var(--background-elevated)] p-3 text-xs shadow-md"
      style={{
        left: Math.min(info.x + 14, window.innerWidth - 300),
        top: Math.min(info.y + 90, window.innerHeight - 190),
      }}
      role="tooltip"
    >
      <p className="technical-label mb-2">HEXÁGONO · H3</p>
      <p className="mb-1 break-all font-mono">{cell.h3Index}</p>
      <p className="mb-1">
        Nivel <strong>{cell.level}</strong> · <strong>{cell.incidentCount}</strong>{" "}
        registros
      </p>
      <p className="mb-1">Periodo: {ROLLING_YEAR_LABEL}</p>
      <p className="mb-0">Categoría principal: {predominantType(cell.incidentTypes)}</p>
    </div>
  );
}
