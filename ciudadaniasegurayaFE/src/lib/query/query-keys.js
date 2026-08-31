import { viewportKey } from "@/features/map/utils/viewport-key";

export const queryKeys = Object.freeze({
  cities: ["catalog", "cities"],
  incidentTypes: ["catalog", "incident-types"],
  mapConfig: ["catalog", "map-config"],
  heatmap({ cityId, period, resolution, bounds, incidentType }) {
    return [
      "heatmap",
      cityId,
      period,
      resolution,
      viewportKey(bounds),
      incidentType || "all",
    ];
  },
  hexagon({ cityId, period, h3Index }) {
    return ["hexagon", cityId, period, h3Index];
  },
  statistics(scope) {
    return ["statistics", scope];
  },
});
