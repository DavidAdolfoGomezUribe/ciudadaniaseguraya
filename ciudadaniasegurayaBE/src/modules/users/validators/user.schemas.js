import { z } from "zod";

import { objectIdStringSchema } from "../../../shared/utils/object-id.js";
import {
  displayNameSchema,
  usernameSchema,
} from "../../auth/validators/auth.schemas.js";

export const userIdParamsSchema = z
  .object({
    userId: objectIdStringSchema,
  })
  .strict();

export const updateOwnBodySchema = z
  .object({
    email: z.email().max(254).optional(),
    username: usernameSchema.optional(),
    displayName: displayNameSchema.optional(),
  })
  .strict()
  .refine(
    (value) =>
      value.email !== undefined ||
      value.username !== undefined ||
      value.displayName !== undefined,
    {
      message: "Envia al menos un campo para actualizar",
    },
  );

export const adminUsersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(["active", "suspended", "deleted"]).optional(),
    role: z.enum(["user", "admin", "superadmin"]).optional(),
  })
  .strict();

export const updateStatusBodySchema = z
  .object({
    status: z.enum(["active", "suspended"]),
  })
  .strict();

export const auditLogsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    action: z.string().trim().min(1).max(100).optional(),
    resourceType: z.string().trim().min(1).max(50).optional(),
  })
  .strict();
