import { z } from "zod";

import { ROLLING_YEAR_PERIOD } from "../utils/rolling-year";

const polygonSchema = z
  .object({
    type: z.enum(["Polygon", "MultiPolygon"]),
    coordinates: z.array(z.unknown()),
  })
  .nullable()
  .optional();

export const citySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  countryCode: z.string(),
  timezone: z.string(),
  boundary: polygonSchema,
  bounds: z
    .object({
      north: z.number(),
      south: z.number(),
      east: z.number(),
      west: z.number(),
    })
    .optional(),
  center: z.object({ latitude: z.number(), longitude: z.number() }).optional(),
});

const responsePeriodSchema = z
  .union([
    z.string(),
    z.object({
      mode: z.literal("rolling_year").optional(),
      from: z.string(),
      to: z.string(),
      timezone: z.string().optional(),
    }),
    z.object({
      mode: z.literal("month"),
      month: z.string(),
      timezone: z.string().optional(),
    }),
  ])
  .optional();

export const heatmapCellSchema = z
  .object({
    h3Index: z.string(),
    resolution: z.number(),
    period: responsePeriodSchema,
    month: z.string().nullable().optional(),
    incidentCount: z.number().int().nonnegative(),
    level: z.number().int().min(0),
    color: z.string(),
    incidentTypes: z.record(z.string(), z.number()).default({}),
    lastUpdatedAt: z.string().nullable().optional(),
  })
  .transform(({ month, ...cell }) => {
    const period =
      typeof cell.period === "string"
        ? cell.period
        : cell.period?.mode === "month"
          ? cell.period.month
          : month || ROLLING_YEAR_PERIOD;

    return {
      ...cell,
      period,
    };
  });

export const hexagonDetailSchema = z.object({
  h3Index: z.string(),
  resolution: z.number(),
  center: z.object({ latitude: z.number(), longitude: z.number() }),
  boundary: z.object({
    type: z.literal("Polygon"),
    coordinates: z.array(z.unknown()),
  }),
  statistics: heatmapCellSchema.nullable(),
  incidents: z.array(z.unknown()).default([]),
});
