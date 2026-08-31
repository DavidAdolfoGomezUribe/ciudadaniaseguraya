import { z } from "zod";

import { usernameSchema } from "../../../auth/validators/auth.schemas.js";
import { objectIdStringSchema } from "../../../../shared/utils/object-id.js";

export const adminResourceParamsSchema = z
  .object({
    userId: objectIdStringSchema.optional(),
    adminId: objectIdStringSchema.optional(),
    requestId: objectIdStringSchema.optional(),
  })
  .strict();

const paginationFields = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
};

export const adminUsersQuerySchema = z
  .object({
    ...paginationFields,
    search: z.string().trim().min(1).max(120).optional(),
    status: z.enum(["active", "suspended", "deleted"]).optional(),
    sortBy: z
      .enum(["createdAt", "updatedAt", "lastLoginAt", "username"])
      .default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

export const administratorsQuerySchema = z
  .object({
    ...paginationFields,
    search: z.string().trim().min(1).max(120).optional(),
    status: z.enum(["active", "suspended", "deleted"]).optional(),
  })
  .strict();

export const updateAdminUserBodySchema = z
  .object({
    username: usernameSchema.optional(),
    displayName: z.string().trim().min(2).max(100).nullable().optional(),
    reason: z.string().trim().min(10).max(1_000),
  })
  .strict()
  .refine(
    ({ username, displayName }) =>
      username !== undefined || displayName !== undefined,
    {
      message: "Envia al menos un campo editable",
    },
  );

export const reasonBodySchema = z
  .object({
    reason: z.string().trim().min(10).max(1_000),
  })
  .strict();

export const deleteAdminUserBodySchema = reasonBodySchema.extend({
  confirmation: z.literal("ELIMINAR"),
});

export const roleRequestBodySchema = z
  .object({
    motivation: z.string().trim().min(30).max(2_000),
    experience: z.string().trim().max(2_000).optional(),
  })
  .strict();

export const adminRecommendationBodySchema = roleRequestBodySchema.extend({
  candidateUserId: objectIdStringSchema,
});

export const roleRequestsQuerySchema = z
  .object({
    ...paginationFields,
    status: z
      .enum(["pending", "approved", "rejected", "cancelled"])
      .optional(),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
  })
  .strict();

export const auditQuerySchema = z
  .object({
    ...paginationFields,
    actorUserId: objectIdStringSchema.optional(),
    role: z.enum(["admin", "superadmin"]).optional(),
    action: z.string().trim().min(1).max(120).optional(),
    resourceType: z.string().trim().min(1).max(80).optional(),
    requestId: z.string().trim().min(1).max(120).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .strict()
  .refine(({ from, to }) => !from || !to || from <= to, {
    message: "El rango de fechas no es valido",
  });

export const updateSettingBodySchema = z
  .object({
    key: z.enum([
      "incidentConfirmationThreshold",
      "incidentMatchWindowMinutes",
    ]),
    value: z.number().int().positive(),
    reason: z.string().trim().min(10).max(1_000),
  })
  .strict()
  .superRefine(({ key, value }, context) => {
    const valid =
      key === "incidentConfirmationThreshold"
        ? value >= 2 && value <= 20
        : value >= 1 && value <= 10_080;
    if (!valid) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "El valor esta fuera del rango permitido",
      });
    }
  });
