import { z } from "zod";

import { apiRequest } from "@/lib/api/api-client";
import { endpoints } from "@/lib/api/endpoints";

import {
  citySchema,
  heatmapCellSchema,
  hexagonDetailSchema,
} from "../schemas/heatmap.schema";

function queryString(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, String(value));
    }
  }
  return search.toString();
}

export const heatmapService = Object.freeze({
  async cities({ signal } = {}) {
    const result = await apiRequest(endpoints.geolocation.cities, { signal });
    return z.array(citySchema).parse(result.data);
  },
  async configuration({ signal } = {}) {
    const result = await apiRequest(endpoints.geolocation.config, { signal });
    return result.data;
  },
  async heatmap(params, { signal } = {}) {
    const result = await apiRequest(
      `${endpoints.geolocation.heatmap}?${queryString(params)}`,
      { signal },
    );
    return z.array(heatmapCellSchema).parse(result.data);
  },
  async hexagon(h3Index, params, { signal } = {}) {
    const result = await apiRequest(
      `${endpoints.geolocation.hexagon(h3Index)}?${queryString(params)}`,
      { signal },
    );
    return hexagonDetailSchema.parse(result.data);
  },
});
