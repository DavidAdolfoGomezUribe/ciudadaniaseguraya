import { cellToParent, getResolution, isValidCell } from "h3-js";

export function eventCellAtResolution(h3Index, targetResolution) {
  if (!isValidCell(h3Index)) return null;
  const sourceResolution = getResolution(h3Index);
  if (sourceResolution < targetResolution) return h3Index;
  return sourceResolution === targetResolution
    ? h3Index
    : cellToParent(h3Index, targetResolution);
}

export function eventIsVisible(event, scope) {
  if (!event?.data || event.data.cityId !== scope.cityId) return false;
  if (typeof event.data.period === "string" && event.data.period !== scope.period) {
    return false;
  }
  if (
    scope.incidentType &&
    event.data.incidentType &&
    event.data.incidentType !== scope.incidentType
  ) {
    return false;
  }
  const index = eventCellAtResolution(event.data.h3Index, scope.resolution);
  return Boolean(index && scope.visibleH3Indexes.has(index));
}
