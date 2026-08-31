const statusMessages = {
  400: "Revisa los datos enviados.",
  401: "Tu sesión terminó. Inicia sesión nuevamente.",
  403: "No tienes permiso para realizar esta acción.",
  404: "No encontramos la información solicitada.",
  409: "La operación entra en conflicto con información existente.",
  422: "La información no pudo procesarse.",
  429: "Se alcanzó el límite de solicitudes. Intenta más tarde.",
  500: "El servicio encontró un problema inesperado.",
  503: "El servicio no está disponible temporalmente.",
};

export class ApiError extends Error {
  constructor({
    message,
    code = "API_ERROR",
    status = 0,
    details = [],
    requestId = null,
    cause,
  }) {
    super(message, { cause });
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.requestId = requestId;
  }
}

export function apiErrorFromResponse(response, payload) {
  return new ApiError({
    message:
      payload?.error?.message ||
      statusMessages[response.status] ||
      "No fue posible completar la solicitud.",
    code: payload?.error?.code || `HTTP_${response.status}`,
    status: response.status,
    details: payload?.error?.details || [],
    requestId: payload?.meta?.requestId || response.headers.get("x-request-id") || null,
  });
}

export function networkApiError(error) {
  if (error?.name === "AbortError") {
    return new ApiError({
      message: "La solicitud tardó demasiado y fue cancelada.",
      code: "REQUEST_TIMEOUT",
      cause: error,
    });
  }

  return new ApiError({
    message: "No fue posible sincronizar los datos con el servicio.",
    code: "NETWORK_ERROR",
    cause: error,
  });
}
