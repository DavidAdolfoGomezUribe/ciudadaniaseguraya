import { OAuth2Client } from "google-auth-library";

import { AppError } from "../../../shared/errors/app-error.js";

function invalidGoogleCredential(cause) {
  return new AppError({
    code: "INVALID_GOOGLE_CREDENTIAL",
    message: "La credencial de Google no es valida",
    statusCode: 401,
    cause,
  });
}

export function createGoogleIdentityProvider({
  clientId,
  oauthClient = clientId ? new OAuth2Client(clientId) : null,
} = {}) {
  return Object.freeze({
    async verifyCredential(credential) {
      if (!clientId || !oauthClient) {
        throw new AppError({
          code: "GOOGLE_AUTH_NOT_CONFIGURED",
          message: "El inicio de sesion con Google no esta disponible",
          statusCode: 503,
        });
      }

      let payload;

      try {
        const ticket = await oauthClient.verifyIdToken({
          idToken: credential,
          audience: clientId,
        });
        payload = ticket.getPayload();
      } catch (error) {
        throw invalidGoogleCredential(error);
      }

      if (
        typeof payload?.sub !== "string" ||
        payload.sub.length === 0 ||
        payload.sub.length > 255 ||
        typeof payload.email !== "string" ||
        payload.email.length === 0 ||
        payload.email.length > 254 ||
        payload.email_verified !== true
      ) {
        throw invalidGoogleCredential();
      }

      return Object.freeze({
        subject: payload.sub,
        email: payload.email,
        name: payload.name ?? null,
      });
    },
  });
}
