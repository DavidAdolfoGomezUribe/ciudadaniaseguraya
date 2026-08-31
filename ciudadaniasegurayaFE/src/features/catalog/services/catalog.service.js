import { z } from "zod";

import { apiRequest } from "@/lib/api/api-client";
import { endpoints } from "@/lib/api/endpoints";

const incidentTypeSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string(),
  severity: z.number(),
});

export const catalogService = Object.freeze({
  async incidentTypes({ signal } = {}) {
    const result = await apiRequest(endpoints.incidents.types, { signal });
    return z.array(incidentTypeSchema).parse(result.data);
  },
});
