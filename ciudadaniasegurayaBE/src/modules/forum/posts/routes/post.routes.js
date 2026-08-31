import {
  emptyResponseSchema,
  errorResponseSchema,
  paginatedResponseSchema,
  successResponseSchema,
} from "../../../../shared/utils/api-schemas.js";
import {
  adminListPostsQuerySchema,
  adminUpdatePostBodySchema,
  createPostBodySchema,
  listPostsQuerySchema,
  moderatePostBodySchema,
  postModerationReasonBodySchema,
  postIdParamsSchema,
  updatePostBodySchema,
} from "../validators/post.schemas.js";

export async function registerPostRoutes(
  app,
  { controller, authenticate, requireAdmin, requirePermission },
) {
  const adminGuard = requirePermission
    ? requirePermission("posts.moderate")
    : requireAdmin;
  app.post(
    "/api/v1/posts",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Posts"],
        summary: "Crea una publicacion",
        security: [{ bearerAuth: [] }],
        body: createPostBodySchema,
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
    "/api/v1/posts",
    {
      schema: {
        tags: ["Posts"],
        summary: "Lista publicaciones activas",
        querystring: listPostsQuerySchema,
        response: {
          200: paginatedResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    controller.list,
  );

  app.get(
    "/api/v1/posts/:postId",
    {
      schema: {
        tags: ["Posts"],
        summary: "Consulta una publicacion",
        params: postIdParamsSchema,
        response: {
          200: successResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    controller.get,
  );

  app.patch(
    "/api/v1/posts/:postId",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Posts"],
        summary: "Edita una publicacion propia",
        security: [{ bearerAuth: [] }],
        params: postIdParamsSchema,
        body: updatePostBodySchema,
        response: {
          200: successResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    controller.update,
  );

  app.delete(
    "/api/v1/posts/:postId",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Posts"],
        summary: "Elimina logicamente una publicacion propia",
        security: [{ bearerAuth: [] }],
        params: postIdParamsSchema,
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
    "/api/v1/admin/posts/:postId/status",
    {
      preHandler: adminGuard,
      schema: {
        tags: ["Admin"],
        summary: "Oculta o restaura una publicacion",
        security: [{ bearerAuth: [] }],
        params: postIdParamsSchema,
        body: moderatePostBodySchema,
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
    "/api/v1/admin/posts",
    {
      preHandler: adminGuard,
      schema: {
        tags: ["Admin", "Post Moderation"],
        summary: "Lista publicaciones para moderacion",
        security: [{ bearerAuth: [] }],
        querystring: adminListPostsQuerySchema,
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
    "/api/v1/admin/posts/:postId",
    {
      preHandler: adminGuard,
      schema: {
        tags: ["Admin", "Post Moderation"],
        summary: "Consulta una publicacion para moderacion",
        security: [{ bearerAuth: [] }],
        params: postIdParamsSchema,
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
    "/api/v1/admin/posts/:postId",
    {
      preHandler: adminGuard,
      schema: {
        tags: ["Admin", "Post Moderation"],
        summary: "Edita una publicacion por moderacion",
        security: [{ bearerAuth: [] }],
        params: postIdParamsSchema,
        body: adminUpdatePostBodySchema,
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
    ["hide", "Oculta una publicacion", controller.hideAdmin],
    ["restore", "Restaura una publicacion oculta", controller.restoreAdmin],
  ]) {
    app.post(
      `/api/v1/admin/posts/:postId/${path}`,
      {
        preHandler: adminGuard,
        schema: {
          tags: ["Admin", "Post Moderation"],
          summary,
          security: [{ bearerAuth: [] }],
          params: postIdParamsSchema,
          body: postModerationReasonBodySchema,
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
    "/api/v1/admin/posts/:postId",
    {
      preHandler: adminGuard,
      schema: {
        tags: ["Admin", "Post Moderation"],
        summary: "Elimina logicamente una publicacion por moderacion",
        security: [{ bearerAuth: [] }],
        params: postIdParamsSchema,
        body: postModerationReasonBodySchema,
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
