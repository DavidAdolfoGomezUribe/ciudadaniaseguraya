import "dotenv/config";

import { isIP } from "node:net";
import { z } from "zod";

import {
  compileOriginPattern,
  normalizeHttpOrigin,
} from "../security/origins.js";

const durationPattern = /^\d+(ms|s|m|h|d)$/;
const mongoUriPattern = /^mongodb(\+srv)?:\/\//;

const rawEnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    HOST: z.string().min(1).default("0.0.0.0"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3010),
    PUBLIC_API_BASE_URL: z.string().trim().default(""),
    TRUST_PROXY: z.string().trim().default("false"),
    MONGODB_URI: z.string().regex(mongoUriPattern),
    MONGODB_DB_NAME: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[A-Za-z0-9_-]+$/)
      .default("ciudadaniaseguraya"),
    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_REFRESH_SECRET: z.string().min(32),
    JWT_ACCESS_EXPIRES_IN: z
      .string()
      .regex(durationPattern)
      .default("15m"),
    JWT_REFRESH_EXPIRES_IN: z
      .string()
      .regex(durationPattern)
      .default("7d"),
    CORS_ORIGINS: z.string().min(1).default("http://localhost:3001"),
    CORS_ORIGIN_PATTERNS: z.string().default(""),
    REFRESH_COOKIE_SAME_SITE: z
      .enum(["strict", "lax", "none"])
      .default("strict"),
    REFRESH_COOKIE_SECURE: z
      .enum(["", "true", "false"])
      .default(""),
    REFRESH_COOKIE_DOMAIN: z.string().trim().max(253).default(""),
    GOOGLE_CLIENT_ID: z
      .union([
        z.literal(""),
        z
          .string()
          .trim()
          .min(20)
          .max(255)
          .regex(/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/),
      ])
      .default(""),
    DEFAULT_CITY_NAME: z.string().min(2).max(100).default("Bogota"),
    DEFAULT_CITY_ID: z
      .union([z.literal(""), z.string().regex(/^[0-9a-fA-F]{24}$/)])
      .default(""),
    DEFAULT_CITY_COUNTRY_CODE: z
      .string()
      .length(2)
      .transform((value) => value.toUpperCase())
      .default("CO"),
    CITY_TIMEZONE: z.string().min(1).default("America/Bogota"),
    H3_BASE_RESOLUTION: z.coerce.number().int().min(0).max(15).default(9),
    H3_SUPPORTED_RESOLUTIONS: z.string().min(1).default("4,5,6,7,8,9"),
    INCIDENT_CONFIRMATION_THRESHOLD: z.coerce
      .number()
      .int()
      .min(2)
      .max(20)
      .default(3),
    INCIDENT_MATCH_WINDOW_MINUTES: z.coerce
      .number()
      .int()
      .min(1)
      .max(10_080)
      .default(180),
    AI_INGEST_API_KEY: z
      .union([z.literal(""), z.string().trim().min(32).max(256)])
      .default(""),
    AGENT_SERVICE_URL: z.string().trim().default(""),
    AGENT_CONTROL_API_KEY: z
      .union([z.literal(""), z.string().trim().min(32).max(256)])
      .default(""),
    AGENT_REQUEST_TIMEOUT_MS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(30_000)
      .default(5_000),
    REALTIME_HEARTBEAT_MS: z.coerce
      .number()
      .int()
      .min(5_000)
      .max(120_000)
      .default(25_000),
    SUPERADMIN_EMAIL: z.union([z.literal(""), z.email()]).default(""),
    SUPERADMIN_USERNAME: z
      .union([
        z.literal(""),
        z.string().min(3).max(32).regex(/^[A-Za-z0-9_.-]+$/),
      ])
      .default(""),
    SUPERADMIN_PASSWORD: z
      .union([z.literal(""), z.string().min(12).max(128)])
      .default(""),
    SUPERADMIN_DISPLAY_NAME: z
      .union([z.literal(""), z.string().trim().min(2).max(100)])
      .default(""),
    ADMIN_AUTH_RATE_LIMIT_MAX: z.coerce
      .number()
      .int()
      .min(1)
      .max(100)
      .default(5),
    ADMIN_AUTH_RATE_LIMIT_WINDOW_MS: z.coerce
      .number()
      .int()
      .min(10_000)
      .max(3_600_000)
      .default(300_000),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    LOG_PRETTY: z.enum(["true", "false"]).default("true"),
  });

function parseResolutions(rawValue) {
  const resolutions = rawValue
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value));

  return [...new Set(resolutions)].sort((left, right) => left - right);
}

function parseCorsOrigins(rawValue) {
  return rawValue
    .split(",")
    .map((value) => normalizeHttpOrigin(value, "Origen CORS"));
}

function parseCorsOriginPatterns(rawValue) {
  if (!rawValue.trim()) {
    return [];
  }

  return rawValue.split(",").map(compileOriginPattern);
}

function validProxyAddress(value) {
  const separator = value.lastIndexOf("/");
  const address = separator === -1 ? value : value.slice(0, separator);
  const version = isIP(address);

  if (!version) {
    return false;
  }
  if (separator === -1) {
    return true;
  }

  const prefix = value.slice(separator + 1);
  const maximum = version === 4 ? 32 : 128;
  return /^\d+$/.test(prefix) && Number(prefix) <= maximum;
}

function parseTrustProxy(rawValue) {
  const value = rawValue.trim().toLowerCase();

  if (!value || value === "false") {
    return false;
  }
  if (value === "true") {
    throw new Error(
      "TRUST_PROXY=true no esta permitido; configura saltos o IP/CIDR explicitos",
    );
  }
  if (/^\d+$/.test(value)) {
    const hops = Number(value);
    if (hops >= 1 && hops <= 10) {
      return hops;
    }
    throw new Error("TRUST_PROXY admite entre 1 y 10 saltos");
  }

  const addresses = value.split(",").map((entry) => entry.trim());
  if (addresses.some((entry) => !validProxyAddress(entry))) {
    throw new Error("TRUST_PROXY contiene una IP o CIDR invalida");
  }

  return addresses.join(",");
}

function parseCookieDomain(rawValue) {
  const domain = rawValue.trim().toLowerCase().replace(/^\./, "");

  if (!domain) {
    return null;
  }
  if (
    isIP(domain) ||
    !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(
      domain,
    )
  ) {
    throw new Error("REFRESH_COOKIE_DOMAIN no es un dominio valido");
  }

  return domain;
}

function assertTimezone(timezone) {
  try {
    new Intl.DateTimeFormat("es-CO", { timeZone: timezone }).format();
  } catch (_error) {
    throw new Error(`Zona horaria invalida: ${timezone}`);
  }
}

export function loadConfig(source = process.env) {
  const compatibleSource = {
    ...source,
    MONGODB_URI: source.MONGODB_URI || source.MONGODB,
  };
  const parsed = rawEnvSchema.safeParse(compatibleSource);

  if (!parsed.success) {
    const fields = parsed.error.issues
      .map((issue) => issue.path.join(".") || "entorno")
      .join(", ");
    throw new Error(`Variables de entorno invalidas o ausentes: ${fields}`);
  }

  const values = parsed.data;
  const refreshCookieSecure =
    values.REFRESH_COOKIE_SECURE === ""
      ? values.NODE_ENV === "production"
      : values.REFRESH_COOKIE_SECURE === "true";
  const h3SupportedResolutions = parseResolutions(
    values.H3_SUPPORTED_RESOLUTIONS,
  );

  if (
    h3SupportedResolutions.length === 0 ||
    h3SupportedResolutions.some(
      (resolution) => resolution < 0 || resolution > 15,
    )
  ) {
    throw new Error("H3_SUPPORTED_RESOLUTIONS contiene valores invalidos");
  }

  if (!h3SupportedResolutions.includes(values.H3_BASE_RESOLUTION)) {
    throw new Error(
      "H3_BASE_RESOLUTION debe estar incluido en H3_SUPPORTED_RESOLUTIONS",
    );
  }

  assertTimezone(values.CITY_TIMEZONE);

  if (values.NODE_ENV === "production" && !refreshCookieSecure) {
    throw new Error(
      "REFRESH_COOKIE_SECURE debe ser true en produccion",
    );
  }
  if (
    values.REFRESH_COOKIE_SAME_SITE === "none" &&
    !refreshCookieSecure
  ) {
    throw new Error(
      "SameSite=None requiere REFRESH_COOKIE_SECURE=true",
    );
  }

  return Object.freeze({
    nodeEnv: values.NODE_ENV,
    host: values.HOST,
    port: values.PORT,
    publicApiBaseUrl: values.PUBLIC_API_BASE_URL
      ? normalizeHttpOrigin(
          values.PUBLIC_API_BASE_URL,
          "PUBLIC_API_BASE_URL",
        )
      : `http://localhost:${values.PORT}`,
    trustProxy: parseTrustProxy(values.TRUST_PROXY),
    mongodbUri: values.MONGODB_URI,
    mongodbDbName: values.MONGODB_DB_NAME,
    jwtAccessSecret: values.JWT_ACCESS_SECRET,
    jwtRefreshSecret: values.JWT_REFRESH_SECRET,
    jwtAccessExpiresIn: values.JWT_ACCESS_EXPIRES_IN,
    jwtRefreshExpiresIn: values.JWT_REFRESH_EXPIRES_IN,
    corsOrigins: parseCorsOrigins(values.CORS_ORIGINS),
    corsOriginPatterns: parseCorsOriginPatterns(
      values.CORS_ORIGIN_PATTERNS,
    ),
    refreshCookieSameSite: values.REFRESH_COOKIE_SAME_SITE,
    refreshCookieSecure,
    refreshCookieDomain: parseCookieDomain(
      values.REFRESH_COOKIE_DOMAIN,
    ),
    googleClientId: values.GOOGLE_CLIENT_ID,
    defaultCityName: values.DEFAULT_CITY_NAME,
    defaultCityId: values.DEFAULT_CITY_ID.toLowerCase() || null,
    defaultCityCountryCode: values.DEFAULT_CITY_COUNTRY_CODE,
    cityTimezone: values.CITY_TIMEZONE,
    h3BaseResolution: values.H3_BASE_RESOLUTION,
    h3SupportedResolutions,
    incidentConfirmationThreshold: values.INCIDENT_CONFIRMATION_THRESHOLD,
    incidentMatchWindowMinutes: values.INCIDENT_MATCH_WINDOW_MINUTES,
    aiIngestApiKey: values.AI_INGEST_API_KEY,
    agentServiceUrl: values.AGENT_SERVICE_URL
      ? normalizeHttpOrigin(values.AGENT_SERVICE_URL, "AGENT_SERVICE_URL")
      : "",
    agentControlApiKey: values.AGENT_CONTROL_API_KEY,
    agentRequestTimeoutMs: values.AGENT_REQUEST_TIMEOUT_MS,
    realtimeHeartbeatMs: values.REALTIME_HEARTBEAT_MS,
    superadminEmail: values.SUPERADMIN_EMAIL,
    superadminUsername: values.SUPERADMIN_USERNAME,
    superadminPassword: values.SUPERADMIN_PASSWORD,
    superadminDisplayName: values.SUPERADMIN_DISPLAY_NAME,
    adminAuthRateLimitMax: values.ADMIN_AUTH_RATE_LIMIT_MAX,
    adminAuthRateLimitWindowMs: values.ADMIN_AUTH_RATE_LIMIT_WINDOW_MS,
    logLevel: values.LOG_LEVEL,
    logPretty: values.LOG_PRETTY === "true",
  });
}
