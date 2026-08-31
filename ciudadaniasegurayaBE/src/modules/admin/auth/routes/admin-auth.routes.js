import {
  emptyResponseSchema,
  errorResponseSchema,
  successResponseSchema,
} from "../../../../shared/utils/api-schemas.js";
import {
  emptyOptionalBodySchema,
  loginBodySchema,
} from "../../../auth/validators/auth.schemas.js";

const commonErrors = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  429: errorResponseSchema,
};

export async function registerAdminAuthRoutes(
  app,
  {
    controller,
    authenticateAdmin,
    verifyTrustedOrigin,
    rateLimitMax,
    rateLimitWindowMs,
  },
) {
  const authRateLimit = {
    max: rateLimitMax,
    timeWindow: rateLimitWindowMs,
  };

  app.post(
    "/api/v1/admin/auth/login",
    {
      config: { rateLimit: authRateLimit },
      preHandler: verifyTrustedOrigin,
      schema: {
        tags: ["Admin Authentication"],
        summary: "Inicia una sesion administrativa aislada",
        body: loginBodySchema,
        response: {
          200: successResponseSchema,
          ...commonErrors,
        },
      },
    },
    controller.login,
  );

  app.post(
    "/api/v1/admin/auth/refresh",
    {
      config: { rateLimit: authRateLimit },
      preHandler: verifyTrustedOrigin,
      schema: {
        tags: ["Admin Authentication"],
        summary: "Rota la sesion administrativa",
        body: emptyOptionalBodySchema,
        response: {
          200: successResponseSchema,
          ...commonErrors,
        },
      },
    },
    controller.refresh,
  );

  app.post(
    "/api/v1/admin/auth/logout",
    {
      config: { rateLimit: authRateLimit },
      preHandler: verifyTrustedOrigin,
      schema: {
        tags: ["Admin Authentication"],
        summary: "Cierra la sesion administrativa actual",
        body: emptyOptionalBodySchema,
        response: {
          204: emptyResponseSchema,
          403: errorResponseSchema,
          429: errorResponseSchema,
        },
      },
    },
    controller.logout,
  );

  app.post(
    "/api/v1/admin/auth/logout-all",
    {
      preHandler: [verifyTrustedOrigin, authenticateAdmin],
      schema: {
        tags: ["Admin Authentication"],
        summary: "Revoca todas las sesiones administrativas propias",
        security: [{ bearerAuth: [] }],
        body: emptyOptionalBodySchema,
        response: {
          204: emptyResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    controller.logoutAll,
  );

  app.get(
    "/api/v1/admin/auth/me",
    {
      preHandler: authenticateAdmin,
      schema: {
        tags: ["Admin Authentication"],
        summary: "Devuelve identidad y permisos administrativos efectivos",
        security: [{ bearerAuth: [] }],
        response: {
          200: successResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    controller.me,
  );
}
