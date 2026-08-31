import { z } from "zod";

import { objectIdStringSchema } from "../../../shared/utils/object-id.js";
import { INCIDENT_TYPE_CODES } from "../../incidents/constants/incident-types.js";

const dateTimeSchema = z.iso.datetime({ offset: true });
const h3IndexSchema = z.string().min(15).max(16);
const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .regex(
    /^[A-Za-z0-9_+\-/]+$/,
    "La zona horaria contiene caracteres no permitidos",
  )
  .optional();

const commonFields = {
  cityId: objectIdStringSchema.optional(),
  h3Index: h3IndexSchema.optional(),
  from: dateTimeSchema.optional(),
  to: dateTimeSchema.optional(),
  incidentType: z.enum(INCIDENT_TYPE_CODES).optional(),
  timezone: timezoneSchema,
};

const hexagonFields = {
  cityId: objectIdStringSchema.optional(),
  from: dateTimeSchema.optional(),
  to: dateTimeSchema.optional(),
  incidentType: z.enum(INCIDENT_TYPE_CODES).optional(),
  timezone: timezoneSchema,
};

function validRange(value) {
  return (
    !value.from ||
    !value.to ||
    new Date(value.from).getTime() < new Date(value.to).getTime()
  );
}

function withValidRange(schema) {
  return schema.refine(validRange, {
    message: "El rango de fechas no es valido",
    path: ["to"],
  });
}

export const statisticsOverviewQuerySchema = withValidRange(
  z.object(commonFields).strict(),
);

export const statisticsTimeseriesQuerySchema = withValidRange(
  z
    .object({
      ...commonFields,
      groupBy: z.enum(["year", "month", "day", "hour"]).default("month"),
    })
    .strict(),
);

export const statisticsHourlyQuerySchema = withValidRange(
  z.object(commonFields).strict(),
);

export const statisticsTypesQuerySchema = withValidRange(
  z.object(commonFields).strict(),
);

export const hexagonStatisticsParamsSchema = z
  .object({
    h3Index: h3IndexSchema,
  })
  .strict();

export const hexagonStatisticsQuerySchema = withValidRange(
  z
    .object({
      ...hexagonFields,
      groupBy: z.enum(["year", "month", "day", "hour"]).default("month"),
    })
    .strict(),
);
