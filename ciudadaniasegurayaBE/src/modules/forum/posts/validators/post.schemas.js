import { z } from "zod";

import { objectIdStringSchema } from "../../../../shared/utils/object-id.js";

const tagsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1)
      .max(24)
      .regex(/^[\p{L}\p{N}_-]+$/u, "Etiqueta invalida"),
  )
  .max(5);
const moderationReasonSchema = z.string().trim().min(10).max(1_000);

export const postIdParamsSchema = z
  .object({
    postId: objectIdStringSchema,
  })
  .strict();

export const createPostBodySchema = z
  .object({
    title: z.string().trim().min(5).max(150),
    content: z.string().trim().min(10).max(10_000),
    tags: tagsSchema.default([]),
    relatedIncidentId: objectIdStringSchema.nullable().optional(),
  })
  .strict();

export const updatePostBodySchema = z
  .object({
    title: z.string().trim().min(5).max(150).optional(),
    content: z.string().trim().min(10).max(10_000).optional(),
    tags: tagsSchema.optional(),
    relatedIncidentId: objectIdStringSchema.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Envia al menos un campo para actualizar",
  });

export const listPostsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    tag: z.string().trim().min(1).max(24).optional(),
    relatedIncidentId: objectIdStringSchema.optional(),
  })
  .strict();

export const moderatePostBodySchema = z
  .object({
    status: z.enum(["active", "hidden"]),
    reason: moderationReasonSchema,
  })
  .strict();

export const adminListPostsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().min(2).max(100).optional(),
    status: z.enum(["active", "hidden", "deleted"]).optional(),
    authorId: objectIdStringSchema.optional(),
    relatedIncidentId: objectIdStringSchema.optional(),
    sortBy: z
      .enum(["createdAt", "updatedAt", "commentCount", "reactionCount"])
      .default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

export const adminUpdatePostBodySchema = updatePostBodySchema
  .safeExtend({
    reason: moderationReasonSchema,
  })
  .refine((value) => Object.keys(value).some((key) => key !== "reason"), {
    message: "Envia al menos un campo para moderar",
  });

export const postModerationReasonBodySchema = z
  .object({
    reason: moderationReasonSchema,
  })
  .strict();
