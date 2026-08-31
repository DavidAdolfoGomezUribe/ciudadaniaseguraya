import { z } from "zod";

import { objectIdStringSchema } from "../../../shared/utils/object-id.js";
import { INCIDENT_TYPE_CODES } from "../constants/incident-types.js";

const incidentTypeSchema = z.enum(INCIDENT_TYPE_CODES);
const latitudeSchema = z.number().min(-90).max(90);
const longitudeSchema = z.number().min(-180).max(180);
const dateTimeSchema = z.iso.datetime({ offset: true });
const httpUrlSchema = z
  .url()
  .max(2_048)
  .refine(
    (value) => ["http:", "https:"].includes(new URL(value).protocol),
    "La URL debe usar HTTP o HTTPS",
  );
const moderationReasonSchema = z.string().trim().min(10).max(1_000);
const expectedUpdatedAtSchema = dateTimeSchema;

const incidentCorrectionsFields = {
  incidentType: incidentTypeSchema.optional(),
  title: z.string().trim().min(5).max(120).optional(),
  description: z.string().trim().min(10).max(2_000).optional(),
  occurredAt: dateTimeSchema.optional(),
  latitude: latitudeSchema.optional(),
  longitude: longitudeSchema.optional(),
  locationPrecision: z
    .enum(["exact", "approximate", "hexagon"])
    .optional(),
  address: z.string().trim().max(200).nullable().optional(),
  neighborhood: z.string().trim().max(100).nullable().optional(),
};

export const incidentIdParamsSchema = z
  .object({
    incidentId: objectIdStringSchema,
  })
  .strict();

export const reportIncidentBodySchema = z
  .object({
    cityId: objectIdStringSchema,
    incidentType: incidentTypeSchema,
    title: z.string().trim().min(5).max(120),
    description: z.string().trim().min(10).max(2_000),
    occurredAt: dateTimeSchema,
    latitude: latitudeSchema,
    longitude: longitudeSchema,
    locationPrecision: z
      .enum(["exact", "approximate", "hexagon"])
      .optional(),
    address: z.string().trim().max(200).optional(),
    neighborhood: z.string().trim().max(100).optional(),
    sourceUrl: httpUrlSchema.optional(),
    evidenceDescription: z.string().trim().max(500).optional(),
  })
  .strict();

export const aiIncidentBodySchema = reportIncidentBodySchema.safeExtend({
  confirmLocation: z.literal(true, {
    error: "Debes confirmar que la ubicacion corresponde al incidente",
  }),
});

const locationPairRefinement = (value) =>
  (value.latitude === undefined && value.longitude === undefined) ||
  (value.latitude !== undefined && value.longitude !== undefined);

export const updateIncidentBodySchema = z
  .object({
    title: z.string().trim().min(5).max(120).optional(),
    description: z.string().trim().min(10).max(2_000).optional(),
    occurredAt: dateTimeSchema.optional(),
    latitude: latitudeSchema.optional(),
    longitude: longitudeSchema.optional(),
    address: z.string().trim().max(200).nullable().optional(),
    neighborhood: z.string().trim().max(100).nullable().optional(),
  })
  .strict()
  .refine(locationPairRefinement, {
    message: "Latitud y longitud deben enviarse juntas",
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Envia al menos un campo para actualizar",
  });

export const adminUpdateIncidentBodySchema = updateIncidentBodySchema
  .safeExtend({
    ...incidentCorrectionsFields,
    sourceUrls: z.array(httpUrlSchema).max(20).optional(),
    reason: moderationReasonSchema,
    expectedUpdatedAt: expectedUpdatedAtSchema,
  })
  .refine(locationPairRefinement, {
    message: "Latitud y longitud deben enviarse juntas",
  })
  .refine(
    (value) =>
      Object.keys(value).some(
        (key) => !["reason", "expectedUpdatedAt"].includes(key),
      ),
    {
      message: "Envia al menos una correccion",
    },
  );

export const adminListIncidentsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    status: z
      .enum([
        "pending",
        "community_confirmed",
        "admin_verified",
        "rejected",
        "archived",
      ])
      .default("pending"),
    cityId: objectIdStringSchema.optional(),
    incidentType: incidentTypeSchema.optional(),
    from: dateTimeSchema.optional(),
    to: dateTimeSchema.optional(),
    minConfirmations: z.coerce.number().int().min(0).optional(),
    source: z.enum(["with", "without"]).optional(),
    possibleDuplicate: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
    sortBy: z
      .enum(["createdAt", "reportedAt", "occurredAt", "confirmationCount"])
      .default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
  })
  .strict()
  .refine(
    (value) =>
      !value.from || !value.to || new Date(value.from) <= new Date(value.to),
    {
      message: "El rango de fechas no es valido",
    },
  );

export const approveIncidentBodySchema = z
  .object({
    reason: moderationReasonSchema,
    sourceUrls: z.array(httpUrlSchema).max(20).default([]),
    corrections: z
      .object(incidentCorrectionsFields)
      .strict()
      .refine(locationPairRefinement, {
        message: "Latitud y longitud deben enviarse juntas",
      })
      .default({}),
    expectedUpdatedAt: expectedUpdatedAtSchema,
  })
  .strict();

export const rejectIncidentBodySchema = z
  .object({
    reasonCode: z.enum([
      "insufficient_evidence",
      "duplicate",
      "incorrect_location",
      "incorrect_date",
      "false_information",
      "outside_supported_area",
      "prohibited_content",
      "other",
    ]),
    reason: moderationReasonSchema,
    expectedUpdatedAt: expectedUpdatedAtSchema,
  })
  .strict();

export const reviewLockBodySchema = z
  .object({
    expectedUpdatedAt: expectedUpdatedAtSchema,
    ttlSeconds: z.coerce.number().int().min(60).max(1_800).default(900),
  })
  .strict();

export const releaseReviewLockBodySchema = z
  .object({
    expectedUpdatedAt: expectedUpdatedAtSchema,
    reason: moderationReasonSchema.optional(),
  })
  .strict();

export const listIncidentsQuerySchema = z
  .object({
    cityId: objectIdStringSchema,
    incidentType: incidentTypeSchema.optional(),
    from: dateTimeSchema.optional(),
    to: dateTimeSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()
  .refine(
    (value) =>
      !value.from || !value.to || new Date(value.from) <= new Date(value.to),
    {
      message: "El rango de fechas no es valido",
    },
  );

export const nearbyIncidentsQuerySchema = z
  .object({
    cityId: objectIdStringSchema,
    latitude: z.coerce.number().min(-90).max(90),
    longitude: z.coerce.number().min(-180).max(180),
    radiusMeters: z.coerce.number().int().min(10).max(20_000).default(2_000),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    incidentType: incidentTypeSchema.optional(),
  })
  .strict();

export const mergeIncidentBodySchema = z
  .object({
    secondaryIncidentId: objectIdStringSchema,
    reason: moderationReasonSchema,
    expectedUpdatedAt: expectedUpdatedAtSchema,
    secondaryExpectedUpdatedAt: expectedUpdatedAtSchema,
  })
  .strict();

export { reportIncidentBodySchema as adminCreateIncidentBodySchema };
