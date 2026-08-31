import {
  emptyResponseSchema,
  errorResponseSchema,
  successResponseSchema,
} from "../../../shared/utils/api-schemas.js";
import {
  updateOwnBodySchema,
  userIdParamsSchema,
} from "../validators/user.schemas.js";

export async function registerUserRoutes(
  app,
  { controller, authenticate },
) {
  app.get(
    "/api/v1/users/:userId",
    {
      schema: {
        tags: ["Users"],
        summary: "Consulta un perfil publico",
        params: userIdParamsSchema,
        response: {
          200: successResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    controller.getPublic,
  );

  app.patch(
    "/api/v1/users/me",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Users"],
        summary: "Actualiza el perfil propio",
        security: [{ bearerAuth: [] }],
        body: updateOwnBodySchema,
        response: {
          200: successResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    controller.updateOwn,
  );

  app.delete(
    "/api/v1/users/me",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Users"],
        summary: "Anonimiza y elimina la cuenta propia",
        security: [{ bearerAuth: [] }],
        response: {
          204: emptyResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    controller.deleteOwn,
  );

}
