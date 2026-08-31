import { apiRequest } from "@/lib/api/api-client";
import { endpoints } from "@/lib/api/endpoints";

export const incidentsService = Object.freeze({
  async createReport(payload, { signal } = {}) {
    const result = await apiRequest(endpoints.incidents.reports, {
      method: "POST",
      body: payload,
      signal,
    });
    return result.data;
  },
});
