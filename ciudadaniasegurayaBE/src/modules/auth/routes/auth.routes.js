import {
  emptyResponseSchema,
  errorResponseSchema,
  successResponseSchema,
} from "../../../shared/utils/api-schemas.js";
import {
  emptyOptionalBodySchema,
  googleCredentialBodySchema,
  loginBodySchema,
  registerBodySchema,
} from "../validators/auth.schemas.js";

const commonErrors = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  409: errorResponseSchema,
  429: errorResponseSchema,
};

export async function registerAuthRoutes(
  app,
  { controller, authenticate, verifyTrustedOrigin },
) {
  app.post(
    "/api/v1/auth/register",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
        },
      },
      preHandler: verifyTrustedOrigin,
      schema: {
        tags: ["Auth"],
        summary: "Crea una cuenta y una sesion",
        description:
          "Registra un usuario, almacena su clave con Argon2id y entrega un access token; el refresh queda exclusivamente en cookie HttpOnly.",
        body: registerBodySchema,
        response: {
          201: successResponseSchema,
          ...commonErrors,
        },
      },
    },
    controller.register,
  );

  app.post(
    "/api/v1/auth/login",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
        },
      },
      preHandler: verifyTrustedOrigin,
      schema: {
        tags: ["Auth"],
        summary: "Inicia una sesion",
        description: "Acepta email o nombre de usuario como identificador.",
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
    "/api/v1/auth/google",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
        },
      },
      preHandler: verifyTrustedOrigin,
      schema: {
        tags: ["Auth"],
        summary: "Inicia sesion con Google",
        description:
          "Verifica una credencial de Google en el backend. Una cuenta local existente debe vincularse desde una sesion autenticada.",
        body: googleCredentialBodySchema,
        response: {
          200: successResponseSchema,
          ...commonErrors,
          503: errorResponseSchema,
        },
      },
    },
    controller.google,
  );

  app.post(
    "/api/v1/auth/google/link",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 minute",
        },
      },
      preHandler: [verifyTrustedOrigin, authenticate],
      schema: {
        tags: ["Auth"],
        summary: "Vincula Google a la cuenta autenticada",
        description:
          "Exige que el correo verificado por Google coincida con el correo de la cuenta actual.",
        security: [{ bearerAuth: [] }],
        body: googleCredentialBodySchema,
        response: {
          200: successResponseSchema,
          ...commonErrors,
          503: errorResponseSchema,
        },
      },
    },
    controller.linkGoogle,
  );

  app.post(
    "/api/v1/auth/refresh",
    {
      preHandler: verifyTrustedOrigin,
      schema: {
        tags: ["Auth"],
        summary: "Rota el refresh token",
        description:
          "Lee y rota exclusivamente el refresh token de la cookie HttpOnly.",
        body: emptyOptionalBodySchema,
        response: {
          200: successResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          429: errorResponseSchema,
        },
      },
    },
    controller.refresh,
  );

  app.post(
    "/api/v1/auth/logout",
    {
      preHandler: verifyTrustedOrigin,
      schema: {
        tags: ["Auth"],
        summary: "Revoca la sesion actual",
        description:
          "Revoca el refresh token recibido exclusivamente mediante cookie HttpOnly.",
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
    "/api/v1/auth/logout-all",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Auth"],
        summary: "Revoca todas las sesiones del usuario",
        security: [{ bearerAuth: [] }],
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
    "/api/v1/auth/me",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Auth"],
        summary: "Devuelve el perfil de la sesion",
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
