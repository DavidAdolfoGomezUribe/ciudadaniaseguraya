import { z } from "zod";

import { objectIdStringSchema } from "../../../shared/utils/object-id.js";
import { INCIDENT_TYPE_CODES } from "../../incidents/constants/incident-types.js";

const monthSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "El mes debe usar el formato YYYY-MM");

export function createCellQuerySchema(defaultResolution) {
  return z
    .object({
      latitude: z.coerce.number().min(-90).max(90),
      longitude: z.coerce.number().min(-180).max(180),
      resolution: z.coerce
        .number()
        .int()
        .min(0)
        .max(15)
        .default(defaultResolution),
    })
    .strict();
}

export const heatmapQuerySchema = z
  .object({
    cityId: objectIdStringSchema,
    month: monthSchema.optional(),
    resolution: z.coerce.number().int().min(0).max(15),
    north: z.coerce.number().min(-90).max(90),
    south: z.coerce.number().min(-90).max(90),
    east: z.coerce.number().min(-180).max(180),
    west: z.coerce.number().min(-180).max(180),
    incidentType: z.enum(INCIDENT_TYPE_CODES).optional(),
  })
  .strict()
  .refine((value) => value.north > value.south, {
    message: "north debe ser mayor que south",
  })
  .refine((value) => value.east > value.west, {
    message: "east debe ser mayor que west",
  });

export const hexagonParamsSchema = z
  .object({
    h3Index: z.string().min(15).max(16),
  })
  .strict();

export const hexagonQuerySchema = z
  .object({
    cityId: objectIdStringSchema,
    month: monthSchema.optional(),
  })
  .strict();
