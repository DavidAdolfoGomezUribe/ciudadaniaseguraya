import {
  clearAdminAccessToken,
  getAdminAccessToken,
  setAdminAccessToken,
} from "@/features/admin/auth/state/admin-access-token-vault";
import { publicEnv } from "@/lib/validation/env.schema";

import { ApiError, networkApiError } from "./api-errors";
import { endpoints } from "./endpoints";
import { parseApiResponse } from "./response-parser";

const DEFAULT_TIMEOUT_MS = 15_000;
export const ADMIN_SESSION_EXPIRED_EVENT = "csy-admin-session-expired";
let refreshPromise = null;

function notifyExpiredSession(error) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(ADMIN_SESSION_EXPIRED_EVENT, {
      detail: { code: error?.code, status: error?.status },
    }),
  );
}

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
  const token = useAuth ? getAdminAccessToken() : null;
  if (token) result.set("Authorization", `Bearer ${token}`);
  return result;
}

async function rawAdminRequest(
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
      cache: "no-store",
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

export async function refreshAdminSession() {
  if (!refreshPromise) {
    refreshPromise = rawAdminRequest(endpoints.admin.auth.refresh, {
      method: "POST",
      auth: false,
    })
      .then((result) => {
        const token = result?.data?.accessToken;
        if (!token) {
          throw new ApiError({
            message: "La sesión administrativa renovada no incluyó un token.",
            code: "INVALID_ADMIN_SESSION",
          });
        }
        setAdminAccessToken(token);
        return result.data;
      })
      .catch((error) => {
        clearAdminAccessToken();
        notifyExpiredSession(error);
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function adminApiRequest(path, options = {}) {
  try {
    return await rawAdminRequest(path, options);
  } catch (error) {
    const canRefresh =
      error instanceof ApiError &&
      error.status === 401 &&
      options.auth !== false &&
      options.retryAuth !== false &&
      path !== endpoints.admin.auth.refresh &&
      path !== endpoints.admin.auth.login;

    if (!canRefresh) throw error;

    await refreshAdminSession();
    try {
      return await rawAdminRequest(path, { ...options, retryAuth: false });
    } catch (retryError) {
      if (retryError?.status === 401) {
        clearAdminAccessToken();
        notifyExpiredSession(retryError);
      }
      throw retryError;
    }
  }
}
