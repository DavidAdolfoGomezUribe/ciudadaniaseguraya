export function toHeatmapDto(stat, period = null) {
  return {
    h3Index: stat.h3Index,
    resolution: stat.h3Resolution,
    month: stat.month ?? null,
    ...(period ? { period } : {}),
    incidentCount: stat.incidentCount,
    level: stat.level,
    color: stat.color,
    incidentTypes: Object.fromEntries(
      Object.entries(stat.incidentTypes ?? {}).filter(([, count]) => count > 0),
    ),
    lastUpdatedAt: stat.lastUpdatedAt
      ? new Date(stat.lastUpdatedAt).toISOString()
      : null,
  };
}
