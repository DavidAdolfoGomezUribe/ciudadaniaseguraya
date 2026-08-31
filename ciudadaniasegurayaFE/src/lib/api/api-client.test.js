import { delay, http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import {
  getAccessToken,
  setAccessToken,
} from "@/features/auth/state/access-token-vault";
import { apiUrl } from "@/tests/mocks/handlers";
import { server } from "@/tests/mocks/server";

import { apiRequest } from "./api-client";

function success(data, meta = {}) {
  return HttpResponse.json({ success: true, data, meta });
}

function unauthorized() {
  return HttpResponse.json(
    {
      success: false,
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message: "La sesión venció.",
        details: [],
      },
    },
    { status: 401 },
  );
}

describe("apiRequest", () => {
  it("devuelve data y meta del contrato exitoso y envia la sesion", async () => {
    setAccessToken("access-token");
    let observedRequest;
    server.use(
      http.get(apiUrl("/api/v1/example"), ({ request }) => {
        observedRequest = request;
        return success({ id: "resource-id" }, { requestId: "request-success" });
      }),
    );

    await expect(apiRequest("/api/v1/example")).resolves.toEqual({
      data: { id: "resource-id" },
      meta: { requestId: "request-success" },
    });
    expect(observedRequest.headers.get("accept")).toBe("application/json");
    expect(observedRequest.headers.get("authorization")).toBe("Bearer access-token");
    expect(observedRequest.credentials).toBe("include");
  });

  it("normaliza errores HTTP conservando codigo, detalles y requestId", async () => {
    server.use(
      http.post(apiUrl("/api/v1/example"), () =>
        HttpResponse.json(
          {
            success: false,
            error: {
              code: "VALIDATION_ERROR",
              message: "El reporte no es válido.",
              details: [{ field: "title", message: "Es requerido." }],
            },
            meta: { requestId: "request-error" },
          },
          { status: 422 },
        ),
      ),
    );

    await expect(
      apiRequest("/api/v1/example", {
        method: "POST",
        body: { title: "" },
      }),
    ).rejects.toMatchObject({
      name: "ApiError",
      code: "VALIDATION_ERROR",
      status: 422,
      message: "El reporte no es válido.",
      details: [{ field: "title", message: "Es requerido." }],
      requestId: "request-error",
    });
  });

  it("devuelve null para una respuesta 204", async () => {
    server.use(
      http.delete(
        apiUrl("/api/v1/example"),
        () => new HttpResponse(null, { status: 204 }),
      ),
    );

    await expect(
      apiRequest("/api/v1/example", { method: "DELETE" }),
    ).resolves.toBeNull();
  });

  it("comparte una unica renovacion entre solicitudes 401 concurrentes", async () => {
    let refreshCalls = 0;
    let protectedCalls = 0;
    let refreshAuthorization;
    setAccessToken("expired-token");

    const protectedHandler = (resource) =>
      http.get(apiUrl(`/api/v1/protected/${resource}`), ({ request }) => {
        protectedCalls += 1;
        if (request.headers.get("authorization") !== "Bearer renewed-token") {
          return unauthorized();
        }
        return success({ resource });
      });

    server.use(
      protectedHandler("one"),
      protectedHandler("two"),
      http.post(apiUrl("/api/v1/auth/refresh"), async ({ request }) => {
        refreshCalls += 1;
        refreshAuthorization = request.headers.get("authorization");
        await delay(30);
        return success({ accessToken: "renewed-token" });
      }),
    );

    await expect(
      Promise.all([
        apiRequest("/api/v1/protected/one"),
        apiRequest("/api/v1/protected/two"),
      ]),
    ).resolves.toEqual([
      { data: { resource: "one" }, meta: {} },
      { data: { resource: "two" }, meta: {} },
    ]);
    expect(refreshCalls).toBe(1);
    expect(protectedCalls).toBe(4);
    expect(refreshAuthorization).toBeNull();
    expect(getAccessToken()).toBe("renewed-token");
  });

  it("convierte la cancelacion por tiempo limite en REQUEST_TIMEOUT", async () => {
    server.use(
      http.get(apiUrl("/api/v1/slow"), async () => {
        await delay(100);
        return success({ completed: true });
      }),
    );

    await expect(apiRequest("/api/v1/slow", { timeoutMs: 10 })).rejects.toMatchObject({
      name: "ApiError",
      code: "REQUEST_TIMEOUT",
      status: 0,
    });
  });
});
