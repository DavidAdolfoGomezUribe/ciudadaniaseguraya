import {
  emptyResponseSchema,
  errorResponseSchema,
  successResponseSchema,
} from "../../../../shared/utils/api-schemas.js";
import {
  commentReactionParamsSchema,
  postReactionParamsSchema,
  reactionBodySchema,
} from "../validators/reaction.schemas.js";

export async function registerReactionRoutes(
  app,
  { controller, authenticate },
) {
  app.post(
    "/api/v1/posts/:postId/reactions",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Reactions"],
        summary: "Reacciona a una publicacion",
        security: [{ bearerAuth: [] }],
        params: postReactionParamsSchema,
        body: reactionBodySchema,
        response: {
          201: successResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    controller.createPost,
  );

  app.delete(
    "/api/v1/posts/:postId/reactions/:reactionType",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Reactions"],
        summary: "Retira una reaccion de una publicacion",
        security: [{ bearerAuth: [] }],
        params: postReactionParamsSchema,
        response: {
          204: emptyResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    controller.removePost,
  );

  app.post(
    "/api/v1/comments/:commentId/reactions",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Reactions"],
        summary: "Reacciona a un comentario",
        security: [{ bearerAuth: [] }],
        params: commentReactionParamsSchema,
        body: reactionBodySchema,
        response: {
          201: successResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    controller.createComment,
  );

  app.delete(
    "/api/v1/comments/:commentId/reactions/:reactionType",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Reactions"],
        summary: "Retira una reaccion de un comentario",
        security: [{ bearerAuth: [] }],
        params: commentReactionParamsSchema,
        response: {
          204: emptyResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    controller.removeComment,
  );
}
