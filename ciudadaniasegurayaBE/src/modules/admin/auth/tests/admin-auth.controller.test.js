import { describe, expect, it, vi } from "vitest";

import { createAdminAuthController } from "../controllers/admin-auth.controller.js";

const config = {
  jwtAccessExpiresIn: "15m",
  refreshCookieSecure: true,
  refreshCookieSameSite: "none",
  refreshCookieDomain: "example.com",
};

function authenticatedResult() {
  return {
    user: {
      id: "user-1",
      role: "superadmin",
      permissions: ["admin.dashboard.read"],
    },
    session: {
      accessToken: "admin-access-token",
      refreshToken: "server-only-admin-refresh",
      refreshExpiresAt: new Date("2026-08-05T12:00:00.000Z"),
      sessionId: "session-1",
    },
  };
}

function request(overrides = {}) {
  return {
    id: "request-1",
    ip: "127.0.0.1",
    headers: { "user-agent": "vitest" },
    cookies: {},
    body: {},
    ...overrides,
  };
}

function reply() {
  return {
    setCookie: vi.fn(),
    clearCookie: vi.fn(),
    code: vi.fn(function code() {
      return this;
    }),
    send: vi.fn((payload) => payload),
  };
}

describe("AdminAuthController", () => {
  it("entrega solo access token y fija la cookie administrativa aislada", async () => {
    const adminAuthService = {
      login: vi.fn(async () => authenticatedResult()),
    };
    const controller = createAdminAuthController({ adminAuthService, config });
    const response = reply();

    const payload = await controller.login(request(), response);

    expect(payload.data).toMatchObject({
      accessToken: "admin-access-token",
      user: { role: "superadmin" },
    });
    expect(payload.data).not.toHaveProperty("refreshToken");
    expect(response.setCookie).toHaveBeenCalledWith(
      "csy_admin_refresh",
      "server-only-admin-refresh",
      expect.objectContaining({
        path: "/api/v1/admin/auth",
        httpOnly: true,
        secure: true,
        sameSite: "none",
      }),
    );
  });

  it("lee el refresh exclusivamente desde la cookie administrativa", async () => {
    const adminAuthService = {
      refresh: vi.fn(async () => authenticatedResult()),
    };
    const controller = createAdminAuthController({ adminAuthService, config });

    await controller.refresh(
      request({
        body: { refreshToken: "body-token" },
        cookies: { csy_admin_refresh: "cookie-token" },
      }),
      reply(),
    );

    expect(adminAuthService.refresh).toHaveBeenCalledWith(
      "cookie-token",
      expect.objectContaining({ requestId: "request-1" }),
    );
  });
});
