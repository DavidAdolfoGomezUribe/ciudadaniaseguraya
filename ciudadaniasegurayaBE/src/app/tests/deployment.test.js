import { afterEach, describe, expect, it } from "vitest";

import { buildApp } from "../app.js";
import { loadConfig } from "../../shared/config/env.js";
import { collectionDefinitions } from "../../shared/database/schema.js";

const applications = [];

function deploymentConfig(overrides = {}) {
  return loadConfig({
    NODE_ENV: "test",
    MONGODB_URI: "mongodb://localhost:27017",
    JWT_ACCESS_SECRET: "a".repeat(32),
    JWT_REFRESH_SECRET: "b".repeat(32),
    CORS_ORIGINS: "http://localhost:3000",
    CORS_ORIGIN_PATTERNS:
      "https://ciudadaniasegurayafe-*-equipo.vercel.app",
    PUBLIC_API_BASE_URL: "https://api.example.com",
    LOG_LEVEL: "silent",
    ...overrides,
  });
}

async function application(config = deploymentConfig()) {
  const collectionNames = collectionDefinitions.map(({ name }) => name);
  const db = {
    command: async () => ({ ok: 1 }),
    collection: () => ({}),
    listCollections: () => ({
      toArray: async () => collectionNames.map((name) => ({ name })),
    }),
  };
  const app = await buildApp({
    config,
    database: { client: {}, db },
  });
  applications.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(applications.splice(0).map((app) => app.close()));
});

describe("integracion de despliegue", () => {
  it("mantiene liveness y readiness fuera del rate limit", async () => {
    const app = await application();
    const healthStatuses = [];

    for (let index = 0; index < 105; index += 1) {
      healthStatuses.push(
        (await app.inject({ method: "GET", url: "/health" })).statusCode,
      );
    }

    expect(new Set(healthStatuses)).toEqual(new Set([200]));
    expect(
      (await app.inject({ method: "GET", url: "/ready" })).statusCode,
    ).toBe(200);
  });

  it("permite el origen local y previews fijados, no cualquier Vercel", async () => {
    const app = await application();
    const preflight = (origin) =>
      app.inject({
        method: "OPTIONS",
        url: "/api/v1/auth/refresh",
        headers: {
          origin,
          "access-control-request-method": "POST",
        },
      });
    const [local, preview, unrelated] = await Promise.all([
      preflight("http://localhost:3000"),
      preflight(
        "https://ciudadaniasegurayafe-a1b2-equipo.vercel.app",
      ),
      preflight("https://otro-proyecto-a1b2-equipo.vercel.app"),
    ]);

    expect(local.statusCode).toBe(204);
    expect(preview.statusCode).toBe(204);
    expect(unrelated.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("rechaza un POST de cookie desde un Origin no confiable", async () => {
    const app = await application();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: {
        origin: "https://attacker.example",
        cookie: "csy_refresh=opaque-token",
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe("UNTRUSTED_ORIGIN");
  });

  it("publica en OpenAPI la URL publica configurada", async () => {
    const app = await application();
    const response = await app.inject({
      method: "GET",
      url: "/docs/json",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().servers).toEqual([
      {
        url: "https://api.example.com",
        description: "Entorno configurado",
      },
    ]);
  });
});
