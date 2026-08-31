export class AppError extends Error {
  constructor({
    code,
    message,
    statusCode = 400,
    details = [],
    cause,
  }) {
    super(message, { cause });
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function notFound(resource = "Recurso") {
  return new AppError({
    code: "NOT_FOUND",
    message: `${resource} no encontrado`,
    statusCode: 404,
  });
}

export function forbidden(message = "No tienes permisos para esta accion") {
  return new AppError({
    code: "FORBIDDEN",
    message,
    statusCode: 403,
  });
}

export function conflict(message, code = "CONFLICT") {
  return new AppError({
    code,
    message,
    statusCode: 409,
  });
}
