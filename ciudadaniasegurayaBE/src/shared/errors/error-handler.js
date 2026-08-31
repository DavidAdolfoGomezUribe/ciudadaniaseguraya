import { MongoServerError } from "mongodb";
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from "fastify-type-provider-zod";

import { AppError } from "./app-error.js";

function errorPayload(request, code, message, details = []) {
  return {
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: {
      requestId: request.id,
    },
  };
}

function validationDetails(error) {
  return error.validation.map((issue) => ({
    path: issue.instancePath || issue.params?.issue?.path?.join(".") || "",
    message: issue.message,
  }));
}

export function setErrorHandlers(app) {
  app.setNotFoundHandler(async (request, reply) =>
    reply
      .code(404)
      .send(errorPayload(request, "ROUTE_NOT_FOUND", "Ruta no encontrada")),
  );

  app.setErrorHandler(async (error, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply
        .code(400)
        .send(
          errorPayload(
            request,
            "VALIDATION_ERROR",
            "Los datos enviados no son validos",
            validationDetails(error),
          ),
        );
    }

    if (isResponseSerializationError(error)) {
      request.log.error(
        { err: error, requestId: request.id },
        "response schema mismatch",
      );
      return reply
        .code(500)
        .send(
          errorPayload(
            request,
            "INTERNAL_ERROR",
            "Ocurrio un error inesperado",
          ),
        );
    }

    if (error instanceof AppError) {
      return reply
        .code(error.statusCode)
        .send(
          errorPayload(request, error.code, error.message, error.details),
        );
    }

    if (error instanceof MongoServerError && error.code === 11000) {
      return reply
        .code(409)
        .send(
          errorPayload(
            request,
            "DUPLICATE_RESOURCE",
            "Ya existe un recurso con esos datos",
          ),
        );
    }

    if (
      error.code === "FST_JWT_NO_AUTHORIZATION_IN_HEADER" ||
      error.code === "FST_JWT_AUTHORIZATION_TOKEN_EXPIRED" ||
      error.code === "FST_JWT_AUTHORIZATION_TOKEN_INVALID"
    ) {
      return reply
        .code(401)
        .send(
          errorPayload(
            request,
            "UNAUTHENTICATED",
            "La sesion no es valida",
          ),
        );
    }

    if (error.statusCode === 429) {
      return reply
        .code(429)
        .send(
          errorPayload(
            request,
            "RATE_LIMIT_EXCEEDED",
            "Demasiadas solicitudes, intenta mas tarde",
          ),
        );
    }

    request.log.error(
      { err: error, requestId: request.id },
      "unhandled request error",
    );
    return reply
      .code(500)
      .send(
        errorPayload(
          request,
          "INTERNAL_ERROR",
          "Ocurrio un error inesperado",
        ),
      );
  });
}
