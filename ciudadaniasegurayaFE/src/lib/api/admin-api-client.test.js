import { delay, http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";

import {
  getAdminAccessToken,
  setAdminAccessToken,
} from "@/features/admin/auth/state/admin-access-token-vault";
import {
  getAccessToken,
  setAccessToken,
} from "@/features/auth/state/access-token-vault";
import { apiUrl } from "@/tests/mocks/handlers";
import { server } from "@/tests/mocks/server";

import { adminApiRequest } from "./admin-api-client";

function success(data) {
  return HttpResponse.json({ success: true, data, meta: {} });
}

function unauthorized() {
  return HttpResponse.json(
    {
      success: false,
      error: { code: "ADMIN_AUTH_REQUIRED", message: "Sesión requerida." },
    },
    { status: 401 },
  );
}

describe("adminApiRequest", () => {
  it("usa exclusivamente el token administrativo en memoria", async () => {
    setAccessToken("public-token");
    setAdminAccessToken("admin-token");
    let authorization;
    let credentials;
    server.use(
      http.get(apiUrl("/api/v1/admin/example"), ({ request }) => {
        authorization = request.headers.get("authorization");
        credentials = request.credentials;
        return success({ ok: true });
      }),
    );

    await expect(adminApiRequest("/api/v1/admin/example")).resolves.toMatchObject({
      data: { ok: true },
    });
    expect(authorization).toBe("Bearer admin-token");
    expect(credentials).toBe("include");
    expect(getAccessToken()).toBe("public-token");
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it("agrupa renovaciones concurrentes y no mezcla el vault público", async () => {
    setAccessToken("public-token");
    setAdminAccessToken("expired-admin-token");
    let refreshCalls = 0;
    server.use(
      http.get(apiUrl("/api/v1/admin/one"), ({ request }) =>
        request.headers.get("authorization") === "Bearer renewed-admin-token"
          ? success({ id: "one" })
          : unauthorized(),
      ),
      http.get(apiUrl("/api/v1/admin/two"), ({ request }) =>
        request.headers.get("authorization") === "Bearer renewed-admin-token"
          ? success({ id: "two" })
          : unauthorized(),
      ),
      http.post(apiUrl("/api/v1/admin/auth/refresh"), async () => {
        refreshCalls += 1;
        await delay(25);
        return success({ accessToken: "renewed-admin-token" });
      }),
    );

    await expect(
      Promise.all([
        adminApiRequest("/api/v1/admin/one"),
        adminApiRequest("/api/v1/admin/two"),
      ]),
    ).resolves.toHaveLength(2);
    expect(refreshCalls).toBe(1);
    expect(getAdminAccessToken()).toBe("renewed-admin-token");
    expect(getAccessToken()).toBe("public-token");
  });
});
