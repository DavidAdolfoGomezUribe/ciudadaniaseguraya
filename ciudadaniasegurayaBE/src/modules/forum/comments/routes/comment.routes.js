import {
  emptyResponseSchema,
  errorResponseSchema,
  paginatedResponseSchema,
  successResponseSchema,
} from "../../../../shared/utils/api-schemas.js";
import { postIdParamsSchema } from "../../posts/validators/post.schemas.js";
import {
  adminListCommentsQuerySchema,
  adminUpdateCommentBodySchema,
  commentModerationReasonBodySchema,
  commentIdParamsSchema,
  createCommentBodySchema,
  listCommentsQuerySchema,
  moderateCommentBodySchema,
  updateCommentBodySchema,
} from "../validators/comment.schemas.js";

export async function registerCommentRoutes(
  app,
  { controller, authenticate, requireAdmin, requirePermission },
) {
  const adminGuard = requirePermission
    ? requirePermission("comments.moderate")
    : requireAdmin;
  app.post(
    "/api/v1/posts/:postId/comments",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Comments"],
        summary: "Comenta una publicacion",
        security: [{ bearerAuth: [] }],
        params: postIdParamsSchema,
        body: createCommentBodySchema,
        response: {
          201: successResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    controller.create,
  );

  app.get(
    "/api/v1/posts/:postId/comments",
    {
      schema: {
        tags: ["Comments"],
        summary: "Lista comentarios de una publicacion",
        params: postIdParamsSchema,
        querystring: listCommentsQuerySchema,
        response: {
          200: paginatedResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    controller.list,
  );

  app.patch(
    "/api/v1/comments/:commentId",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Comments"],
        summary: "Edita un comentario propio",
        security: [{ bearerAuth: [] }],
        params: commentIdParamsSchema,
        body: updateCommentBodySchema,
        response: {
          200: successResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    controller.update,
  );

  app.delete(
    "/api/v1/comments/:commentId",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Comments"],
        summary: "Elimina logicamente un comentario propio",
        security: [{ bearerAuth: [] }],
        params: commentIdParamsSchema,
        response: {
          204: emptyResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    controller.remove,
  );

  app.patch(
    "/api/v1/admin/comments/:commentId/status",
    {
      preHandler: adminGuard,
      schema: {
        tags: ["Admin"],
        summary: "Oculta o restaura un comentario",
        security: [{ bearerAuth: [] }],
        params: commentIdParamsSchema,
        body: moderateCommentBodySchema,
        response: {
          200: successResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    controller.moderate,
  );

  app.get(
    "/api/v1/admin/comments",
    {
      preHandler: adminGuard,
      schema: {
        tags: ["Admin", "Comment Moderation"],
        summary: "Lista comentarios para moderacion",
        security: [{ bearerAuth: [] }],
        querystring: adminListCommentsQuerySchema,
        response: {
          200: paginatedResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    controller.listAdmin,
  );

  app.get(
    "/api/v1/admin/comments/:commentId",
    {
      preHandler: adminGuard,
      schema: {
        tags: ["Admin", "Comment Moderation"],
        summary: "Consulta un comentario y su contexto para moderacion",
        security: [{ bearerAuth: [] }],
        params: commentIdParamsSchema,
        response: {
          200: successResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    controller.getAdmin,
  );

  app.patch(
    "/api/v1/admin/comments/:commentId",
    {
      preHandler: adminGuard,
      schema: {
        tags: ["Admin", "Comment Moderation"],
        summary: "Edita un comentario por una razon de moderacion",
        security: [{ bearerAuth: [] }],
        params: commentIdParamsSchema,
        body: adminUpdateCommentBodySchema,
        response: {
          200: successResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    controller.updateAdmin,
  );

  for (const [path, summary, handler] of [
    ["hide", "Oculta un comentario", controller.hideAdmin],
    ["restore", "Restaura un comentario oculto", controller.restoreAdmin],
  ]) {
    app.post(
      `/api/v1/admin/comments/:commentId/${path}`,
      {
        preHandler: adminGuard,
        schema: {
          tags: ["Admin", "Comment Moderation"],
          summary,
          security: [{ bearerAuth: [] }],
          params: commentIdParamsSchema,
          body: commentModerationReasonBodySchema,
          response: {
            200: successResponseSchema,
            400: errorResponseSchema,
            401: errorResponseSchema,
            403: errorResponseSchema,
            404: errorResponseSchema,
          },
        },
      },
      handler,
    );
  }

  app.delete(
    "/api/v1/admin/comments/:commentId",
    {
      preHandler: adminGuard,
      schema: {
        tags: ["Admin", "Comment Moderation"],
        summary: "Elimina logicamente un comentario por moderacion",
        security: [{ bearerAuth: [] }],
        params: commentIdParamsSchema,
        body: commentModerationReasonBodySchema,
        response: {
          204: emptyResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    controller.deleteAdmin,
  );
}
