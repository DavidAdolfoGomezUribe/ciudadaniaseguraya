import { fallbackStyle } from "./hexagon-colors";

export function mergeHeatmapData(h3Indexes, stats, period) {
  const statsByIndex = new Map(stats.map((stat) => [stat.h3Index, stat]));

  return h3Indexes.map((h3Index) => {
    const stat = statsByIndex.get(h3Index);
    if (stat) return stat;
    const style = fallbackStyle(0);
    return {
      h3Index,
      resolution: null,
      period,
      incidentCount: 0,
      level: style.level,
      color: style.color,
      incidentTypes: {},
      lastUpdatedAt: null,
    };
  });
}
