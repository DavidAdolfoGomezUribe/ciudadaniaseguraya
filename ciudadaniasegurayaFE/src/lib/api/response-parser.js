import { ApiError, apiErrorFromResponse } from "./api-errors";

export async function parseApiResponse(response) {
  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  let payload = null;

  if (contentType.includes("application/json")) {
    payload = await response.json();
  } else {
    const text = await response.text();
    if (text) {
      throw new ApiError({
        message: "El servicio respondió con un formato inesperado.",
        code: "INVALID_RESPONSE",
        status: response.status,
      });
    }
  }

  if (!response.ok || payload?.success === false) {
    throw apiErrorFromResponse(response, payload);
  }

  if (!payload || payload.success !== true) {
    throw new ApiError({
      message: "El servicio respondió con un contrato no reconocido.",
      code: "INVALID_RESPONSE",
      status: response.status,
    });
  }

  return {
    data: payload.data,
    meta: payload.meta || {},
  };
}
