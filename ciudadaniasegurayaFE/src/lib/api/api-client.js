import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "@/features/auth/state/access-token-vault";
import { publicEnv } from "@/lib/validation/env.schema";

import { ApiError, networkApiError } from "./api-errors";
import { endpoints } from "./endpoints";
import { parseApiResponse } from "./response-parser";

const DEFAULT_TIMEOUT_MS = 12_000;
let refreshPromise = null;

function createRequestSignal(signal, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(new DOMException("Timeout", "AbortError")),
    timeoutMs,
  );

  const abortFromSource = () =>
    controller.abort(signal?.reason || new DOMException("Aborted", "AbortError"));

  if (signal?.aborted) abortFromSource();
  else signal?.addEventListener("abort", abortFromSource, { once: true });

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", abortFromSource);
    },
  };
}

function requestHeaders(headers, body, useAuth) {
  const result = new Headers(headers);
  result.set("Accept", "application/json");

  if (body !== undefined && !(body instanceof FormData)) {
    result.set("Content-Type", "application/json");
  }

  const token = useAuth ? getAccessToken() : null;
  if (token) result.set("Authorization", `Bearer ${token}`);
  return result;
}

async function rawRequest(
  path,
  {
    method = "GET",
    body,
    headers,
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    auth = true,
  } = {},
) {
  const requestSignal = createRequestSignal(signal, timeoutMs);

  try {
    const response = await fetch(new URL(path, publicEnv.apiBaseUrl), {
      method,
      credentials: "include",
      headers: requestHeaders(headers, body, auth),
      body:
        body === undefined || body instanceof FormData ? body : JSON.stringify(body),
      signal: requestSignal.signal,
    });

    return await parseApiResponse(response);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw networkApiError(error);
  } finally {
    requestSignal.cleanup();
  }
}

export async function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = rawRequest(endpoints.auth.refresh, {
      method: "POST",
      auth: false,
    })
      .then((result) => {
        const token = result?.data?.accessToken;
        if (!token) {
          throw new ApiError({
            message: "La sesión renovada no incluyó un token de acceso.",
            code: "INVALID_SESSION",
          });
        }
        setAccessToken(token);
        return result.data;
      })
      .catch((error) => {
        clearAccessToken();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function apiRequest(path, options = {}) {
  try {
    return await rawRequest(path, options);
  } catch (error) {
    const canRefresh =
      error instanceof ApiError &&
      error.status === 401 &&
      options.auth !== false &&
      options.retryAuth !== false &&
      path !== endpoints.auth.refresh;

    if (!canRefresh) throw error;

    await refreshSession();
    return rawRequest(path, { ...options, retryAuth: false });
  }
}
