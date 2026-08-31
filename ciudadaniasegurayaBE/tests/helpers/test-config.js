import "dotenv/config";

import { randomBytes } from "node:crypto";

import { loadConfig } from "../../src/shared/config/env.js";

function testMongoUri() {
  const configured =
    process.env.MONGODB_TEST_URI ||
    process.env.MONGODB_URI ||
    process.env.MONGODB;

  if (!configured) {
    throw new Error(
      "Define MONGODB_TEST_URI o MONGODB_URI para ejecutar pruebas MongoDB",
    );
  }

  if (process.env.MONGODB_TEST_LOCALHOST !== "true") {
    return configured;
  }

  const localUri = new URL(configured);
  localUri.hostname = "127.0.0.1";
  localUri.port = process.env.MONGODB_TEST_PORT || "27017";
  return localUri.toString();
}

export function createTestConfig(databaseName, overrides = {}) {
  return loadConfig({
    ...process.env,
    NODE_ENV: "test",
    HOST: "127.0.0.1",
    PORT: "3010",
    PUBLIC_API_BASE_URL: "http://localhost:3010",
    TRUST_PROXY: "false",
    MONGODB_URI: testMongoUri(),
    MONGODB_DB_NAME: databaseName,
    JWT_ACCESS_SECRET: randomBytes(32).toString("hex"),
    JWT_REFRESH_SECRET: randomBytes(32).toString("hex"),
    JWT_ACCESS_EXPIRES_IN: "15m",
    JWT_REFRESH_EXPIRES_IN: "7d",
    CORS_ORIGINS: "http://localhost:3001",
    CORS_ORIGIN_PATTERNS: "",
    REFRESH_COOKIE_SAME_SITE: "strict",
    REFRESH_COOKIE_SECURE: "false",
    REFRESH_COOKIE_DOMAIN: "",
    GOOGLE_CLIENT_ID: "",
    DEFAULT_CITY_NAME: "Bogota",
    DEFAULT_CITY_ID: "",
    DEFAULT_CITY_COUNTRY_CODE: "CO",
    CITY_TIMEZONE: "America/Bogota",
    H3_BASE_RESOLUTION: "9",
    H3_SUPPORTED_RESOLUTIONS: "4,5,6,7,8,9",
    INCIDENT_CONFIRMATION_THRESHOLD: "3",
    INCIDENT_MATCH_WINDOW_MINUTES: "180",
    AI_INGEST_API_KEY: "",
    AGENT_SERVICE_URL: "",
    AGENT_CONTROL_API_KEY: "",
    AGENT_REQUEST_TIMEOUT_MS: "5000",
    REALTIME_HEARTBEAT_MS: "5000",
    SUPERADMIN_EMAIL: "",
    SUPERADMIN_USERNAME: "",
    SUPERADMIN_PASSWORD: "",
    SUPERADMIN_DISPLAY_NAME: "",
    ADMIN_AUTH_RATE_LIMIT_MAX: "5",
    ADMIN_AUTH_RATE_LIMIT_WINDOW_MS: "300000",
    LOG_LEVEL: "silent",
    LOG_PRETTY: "false",
    ...overrides,
  });
}
