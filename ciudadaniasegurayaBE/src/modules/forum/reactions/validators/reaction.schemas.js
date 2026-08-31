import { z } from "zod";

import { objectIdStringSchema } from "../../../../shared/utils/object-id.js";

export const reactionTypeSchema = z.enum(["like", "helpful", "concerned"]);

export const reactionBodySchema = z
  .object({
    reactionType: reactionTypeSchema,
  })
  .strict();

export const postReactionParamsSchema = z
  .object({
    postId: objectIdStringSchema,
    reactionType: reactionTypeSchema.optional(),
  })
  .strict();

export const commentReactionParamsSchema = z
  .object({
    commentId: objectIdStringSchema,
    reactionType: reactionTypeSchema.optional(),
  })
  .strict();
