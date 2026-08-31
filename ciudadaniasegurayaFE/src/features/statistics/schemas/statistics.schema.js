import { z } from "zod";

export const seriesItemSchema = z
  .object({
    key: z.union([z.string(), z.number()]).optional(),
    incidentType: z.string().optional(),
    label: z.string().optional(),
    incidentCount: z.number().int().nonnegative(),
  })
  .passthrough()
  .transform((item) => ({
    ...item,
    key: item.key ?? item.incidentType ?? item.label ?? "unknown",
  }));

export const seriesResponseSchema = z
  .object({
    scope: z.record(z.string(), z.unknown()).optional(),
    period: z.record(z.string(), z.unknown()).optional(),
    series: z.array(seriesItemSchema).default([]),
    total: z.number().optional(),
    previousPeriodTotal: z.number().optional(),
    variationPercentage: z.number().nullable().optional(),
    lastUpdatedAt: z.string().nullable().optional(),
  })
  .passthrough();

const nullableDateTimeSchema = z.string().nullable().optional();

export const hexagonStatisticsSchema = z
  .object({
    scope: z.record(z.string(), z.unknown()).optional(),
    period: z.record(z.string(), z.unknown()).optional(),
    overview: z
      .object({
        totalIncidents: z.number().int().nonnegative(),
        validation: z.object({
          communityConfirmed: z.number().int().nonnegative(),
          adminVerified: z.number().int().nonnegative(),
        }),
        lastUpdatedAt: nullableDateTimeSchema,
        comparison: z.object({
          previousIncidentCount: z.number().int().nonnegative(),
          absoluteChange: z.number().int(),
          percentageChange: z.number().nullable(),
        }),
      })
      .passthrough(),
    timeseries: seriesResponseSchema,
    hourly: z
      .object({
        series: z.array(seriesItemSchema).default([]),
        lastUpdatedAt: nullableDateTimeSchema,
        summary: z.object({
          totalIncidents: z.number().int().nonnegative(),
          averagePerHour: z.number().nonnegative(),
          busiestHours: z.array(z.number().int().min(0).max(23)),
          quietestHours: z.array(z.number().int().min(0).max(23)),
        }),
      })
      .passthrough(),
    types: seriesResponseSchema,
    nearbyComparison: z.object({
      center: z.object({
        h3Index: z.string(),
        incidentCount: z.number().int().nonnegative(),
      }),
      neighbors: z.array(
        z.object({
          h3Index: z.string(),
          incidentCount: z.number().int().nonnegative(),
        }),
      ),
      averageNeighborCount: z.number().nonnegative(),
      absoluteDifference: z.number(),
      percentageDifference: z.number().nullable(),
      lastUpdatedAt: nullableDateTimeSchema,
    }),
  })
  .passthrough();
