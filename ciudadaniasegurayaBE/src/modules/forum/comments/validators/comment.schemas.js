import { z } from "zod";

import { objectIdStringSchema } from "../../../../shared/utils/object-id.js";

const moderationReasonSchema = z.string().trim().min(10).max(1_000);

export const commentIdParamsSchema = z
  .object({
    commentId: objectIdStringSchema,
  })
  .strict();

export const createCommentBodySchema = z
  .object({
    content: z.string().trim().min(2).max(3_000),
    parentCommentId: objectIdStringSchema.nullable().optional(),
  })
  .strict();

export const updateCommentBodySchema = z
  .object({
    content: z.string().trim().min(2).max(3_000),
  })
  .strict();

export const listCommentsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();

export const moderateCommentBodySchema = z
  .object({
    status: z.enum(["active", "hidden"]),
    reason: moderationReasonSchema,
  })
  .strict();

export const adminListCommentsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().min(2).max(100).optional(),
    status: z.enum(["active", "hidden", "deleted"]).optional(),
    authorId: objectIdStringSchema.optional(),
    postId: objectIdStringSchema.optional(),
    sortBy: z.enum(["createdAt", "updatedAt"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

export const adminUpdateCommentBodySchema = z
  .object({
    content: z.string().trim().min(2).max(3_000),
    reason: moderationReasonSchema,
  })
  .strict();

export const commentModerationReasonBodySchema = z
  .object({
    reason: moderationReasonSchema,
  })
  .strict();
