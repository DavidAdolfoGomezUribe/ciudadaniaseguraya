import { describe, expect, it, vi } from "vitest";

import { createAuthController } from "../controllers/auth.controller.js";

const config = {
  jwtAccessExpiresIn: "15m",
  refreshCookieSecure: true,
  refreshCookieSameSite: "none",
  refreshCookieDomain: "example.com",
};

function authenticatedResult() {
  return {
    user: { id: "user-1" },
    session: {
      accessToken: "access-token",
      refreshToken: "server-only-refresh-token",
      refreshExpiresAt: new Date("2026-08-02T12:00:00.000Z"),
    },
  };
}

function createReply() {
  return {
    setCookie: vi.fn(),
    clearCookie: vi.fn(),
    code: vi.fn(function code() {
      return this;
    }),
    send: vi.fn((payload) => payload),
  };
}

describe("AuthController", () => {
  it("entrega el access token sin exponer el refresh token en JSON", async () => {
    const authService = {
      login: vi.fn(async () => authenticatedResult()),
    };
    const controller = createAuthController({ authService, config });
    const reply = createReply();

    const response = await controller.login(
      { body: {}, cookies: {}, id: "req-1" },
      reply,
    );

    expect(response.data).toMatchObject({
      accessToken: "access-token",
      accessTokenExpiresIn: "15m",
      refreshTokenExpiresAt: "2026-08-02T12:00:00.000Z",
    });
    expect(response.data).not.toHaveProperty("refreshToken");
    expect(reply.setCookie).toHaveBeenCalledWith(
      "csy_refresh",
      "server-only-refresh-token",
      expect.objectContaining({
        path: "/api/v1/auth",
        httpOnly: true,
        secure: true,
        sameSite: "none",
        domain: "example.com",
      }),
    );
  });

  it("rota exclusivamente el refresh token recibido en cookie", async () => {
    const authService = {
      refresh: vi.fn(async () => authenticatedResult()),
    };
    const controller = createAuthController({ authService, config });

    await controller.refresh(
      {
        body: { refreshToken: "token-del-body" },
        cookies: { csy_refresh: "token-de-cookie" },
        id: "req-2",
      },
      createReply(),
    );

    expect(authService.refresh).toHaveBeenCalledWith("token-de-cookie");
  });

  it("limpia la misma topologia de cookie al cerrar sesion", async () => {
    const authService = {
      logout: vi.fn(async () => {}),
    };
    const controller = createAuthController({ authService, config });
    const reply = createReply();

    await controller.logout(
      {
        cookies: { csy_refresh: "token-de-cookie" },
      },
      reply,
    );

    expect(reply.clearCookie).toHaveBeenCalledWith("csy_refresh", {
      path: "/api/v1/auth",
      httpOnly: true,
      secure: true,
      sameSite: "none",
      domain: "example.com",
    });
  });
});
