import { describe, expect, it } from "vitest";

import { loadConfig } from "../env.js";
import { isAllowedOrigin } from "../../security/origins.js";

function requiredEnvironment(overrides = {}) {
  return {
    NODE_ENV: "test",
    MONGODB_URI: "mongodb://localhost:27017",
    JWT_ACCESS_SECRET: "a".repeat(32),
    JWT_REFRESH_SECRET: "b".repeat(32),
    ...overrides,
  };
}

describe("configuracion de despliegue", () => {
  it("usa Next local, cookie same-site y proxy no confiable por defecto", () => {
    const config = loadConfig(requiredEnvironment());

    expect(config.corsOrigins).toEqual(["http://localhost:3001"]);
    expect(config.corsOriginPatterns).toEqual([]);
    expect(config.refreshCookieSameSite).toBe("strict");
    expect(config.refreshCookieSecure).toBe(false);
    expect(config.refreshCookieDomain).toBeNull();
    expect(config.trustProxy).toBe(false);
    expect(config.publicApiBaseUrl).toBe("http://localhost:3010");
    expect(config.aiIngestApiKey).toBe("");
    expect(config.agentServiceUrl).toBe("");
    expect(config.defaultCityId).toBeNull();
  });

  it("configura previews fijados, API publica y un salto de proxy", () => {
    const config = loadConfig(
      requiredEnvironment({
        PUBLIC_API_BASE_URL: "https://api.example.com",
        TRUST_PROXY: "1",
        CORS_ORIGINS: "https://app.example.com",
        CORS_ORIGIN_PATTERNS:
          "https://ciudadaniasegurayafe-*-equipo.vercel.app",
        REFRESH_COOKIE_SAME_SITE: "none",
        REFRESH_COOKIE_SECURE: "true",
        REFRESH_COOKIE_DOMAIN: ".example.com",
        GOOGLE_CLIENT_ID:
          "123456789-ciudadania.apps.googleusercontent.com",
      }),
    );

    expect(config.publicApiBaseUrl).toBe("https://api.example.com");
    expect(config.trustProxy).toBe(1);
    expect(config.refreshCookieSameSite).toBe("none");
    expect(config.refreshCookieSecure).toBe(true);
    expect(config.refreshCookieDomain).toBe("example.com");
    expect(config.googleClientId).toContain(".apps.googleusercontent.com");
    expect(
      isAllowedOrigin(
        "https://ciudadaniasegurayafe-a1b2-equipo.vercel.app",
        config.corsOrigins,
        config.corsOriginPatterns,
      ),
    ).toBe(true);
  });

  it("acepta solo IP/CIDR o saltos acotados para TRUST_PROXY", () => {
    expect(
      loadConfig(
        requiredEnvironment({
          TRUST_PROXY: "127.0.0.1,10.0.0.0/8",
        }),
      ).trustProxy,
    ).toBe("127.0.0.1,10.0.0.0/8");
    expect(() =>
      loadConfig(requiredEnvironment({ TRUST_PROXY: "true" })),
    ).toThrow(/no esta permitido/);
    expect(() =>
      loadConfig(requiredEnvironment({ TRUST_PROXY: "999" })),
    ).toThrow(/entre 1 y 10/);
  });

  it("valida las credenciales bootstrap y el rate limit administrativo", () => {
    const config = loadConfig(
      requiredEnvironment({
        SUPERADMIN_EMAIL: "root@example.com",
        SUPERADMIN_USERNAME: "root_admin",
        SUPERADMIN_PASSWORD: "Clave-Superadmin-2026",
        SUPERADMIN_DISPLAY_NAME: "Superadmin Principal",
        ADMIN_AUTH_RATE_LIMIT_MAX: "4",
        ADMIN_AUTH_RATE_LIMIT_WINDOW_MS: "180000",
      }),
    );

    expect(config).toMatchObject({
      superadminEmail: "root@example.com",
      superadminUsername: "root_admin",
      superadminDisplayName: "Superadmin Principal",
      adminAuthRateLimitMax: 4,
      adminAuthRateLimitWindowMs: 180000,
    });
  });

  it("acepta una clave de ingesta IA robusta y rechaza claves cortas", () => {
    const apiKey = "i".repeat(32);

    expect(
      loadConfig(requiredEnvironment({ AI_INGEST_API_KEY: apiKey }))
        .aiIngestApiKey,
    ).toBe(apiKey);
    expect(() =>
      loadConfig(requiredEnvironment({ AI_INGEST_API_KEY: "muy-corta" })),
    ).toThrow(/AI_INGEST_API_KEY/);
  });

  it("validates agent control and deterministic local city configuration", () => {
    const config = loadConfig(
      requiredEnvironment({
        AGENT_SERVICE_URL: "http://agent:8000",
        AGENT_CONTROL_API_KEY: "c".repeat(32),
        DEFAULT_CITY_ID: "66a000000000000000000001",
      }),
    );

    expect(config.agentServiceUrl).toBe("http://agent:8000");
    expect(config.agentControlApiKey).toBe("c".repeat(32));
    expect(config.defaultCityId).toBe("66a000000000000000000001");
    expect(() =>
      loadConfig(requiredEnvironment({ AGENT_CONTROL_API_KEY: "short" })),
    ).toThrow(/AGENT_CONTROL_API_KEY/);
  });

  it("exige cookies Secure en produccion y con SameSite=None", () => {
    expect(() =>
      loadConfig(
        requiredEnvironment({
          NODE_ENV: "production",
          REFRESH_COOKIE_SECURE: "false",
        }),
      ),
    ).toThrow(/debe ser true en produccion/);
    expect(() =>
      loadConfig(
        requiredEnvironment({
          REFRESH_COOKIE_SAME_SITE: "none",
          REFRESH_COOKIE_SECURE: "false",
        }),
      ),
    ).toThrow(/SameSite=None/);

    expect(
      loadConfig(
        requiredEnvironment({
          NODE_ENV: "production",
        }),
      ).refreshCookieSecure,
    ).toBe(true);
  });
});
