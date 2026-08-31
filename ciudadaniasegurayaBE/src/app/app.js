import compress from "@fastify/compress";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import sse from "@fastify/sse";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import underPressure from "@fastify/under-pressure";
import Fastify, { LogController } from "fastify";
import {
  jsonSchemaTransform,
  jsonSchemaTransformObject,
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";

import { registerRoutes } from "./routes.js";
import { createCacheProvider } from "../infrastructure/cache/memory-cache.js";
import { createEventBus } from "../infrastructure/messaging/event-bus.js";
import databasePlugin from "../shared/database/connection/database.plugin.js";
import { setErrorHandlers } from "../shared/errors/error-handler.js";
import { isAllowedOrigin } from "../shared/security/origins.js";

function buildLoggerOptions(config) {
  if (config.nodeEnv === "test") {
    return false;
  }

  const base = {
    level: config.logLevel,
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "request.headers.authorization",
        "request.headers.cookie",
        "password",
        "passwordHash",
        "refreshToken",
        "token",
      ],
      censor: "[REDACTED]",
    },
  };

  if (config.nodeEnv === "development" && config.logPretty) {
    base.transport = {
      target: "pino-pretty",
      options: {
        colorize: true,
        singleLine: true,
        translateTime: "SYS:standard",
      },
    };
  }

  return base;
}

export async function buildApp({
  config,
  database,
  eventBus = createEventBus(),
  cache = createCacheProvider(),
  googleIdentityProvider,
  logger,
} = {}) {
  if (!config) {
    throw new Error("buildApp requiere una configuracion validada");
  }

  const app = Fastify({
    logger: logger ?? buildLoggerOptions(config),
    bodyLimit: 1024 * 1024,
    requestTimeout: 15_000,
    handlerTimeout: 15_000,
    connectionTimeout: 10_000,
    keepAliveTimeout: 72_000,
    requestIdHeader: "x-request-id",
    trustProxy: config.trustProxy,
    logController: new LogController({
      disableRequestLogging: true,
    }),
  });

  app.decorate("config", config);
  app.decorate("eventBus", eventBus);
  app.decorate("cache", cache);
  app.decorate("startedAt", new Date());

  app.addHook("onRoute", (routeOptions) => {
    if (routeOptions.schema?.summary && !routeOptions.schema.description) {
      routeOptions.schema.description = routeOptions.schema.summary;
    }
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(sensible);
  await app.register(cors, {
    credentials: true,
    origin(origin, callback) {
      callback(
        null,
        isAllowedOrigin(
          origin,
          config.corsOrigins,
          config.corsOriginPatterns,
        ),
      );
    },
  });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  });
  await app.register(cookie);
  await app.register(compress, {
    global: true,
    threshold: 1024,
  });
  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: "1 minute",
  });
  await app.register(underPressure, {
    exposeStatusRoute: false,
    maxEventLoopDelay: 1_000,
    maxEventLoopUtilization: 0.98,
    maxHeapUsedBytes: 0,
    maxRssBytes: 0,
    retryAfter: 10,
  });
  await app.register(jwt, {
    secret: config.jwtAccessSecret,
    sign: {
      expiresIn: config.jwtAccessExpiresIn,
    },
  });
  await app.register(sse, {
    heartbeatInterval: config.realtimeHeartbeatMs,
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Ciudadania Segura Ya API",
        description:
          "API para reportes comunitarios, incidentes validados, mapa H3 y foro ciudadano.",
        version: "1.0.0",
      },
      servers: [
        {
          url: config.publicApiBaseUrl,
          description:
            config.nodeEnv === "production"
              ? "Entorno de produccion"
              : "Entorno configurado",
        },
      ],
      tags: [
        { name: "Health", description: "Salud y disponibilidad" },
        { name: "Auth", description: "Registro y sesiones" },
        { name: "Users", description: "Perfiles de usuario" },
        { name: "Incidents", description: "Incidentes y reportes" },
        {
          name: "Integrations",
          description: "Integraciones servidor a servidor",
        },
        { name: "Geolocation", description: "H3 y mapa de calor" },
        {
          name: "Statistics",
          description: "Agregaciones publicas de incidentes validados",
        },
        { name: "Posts", description: "Publicaciones del foro" },
        { name: "Comments", description: "Comentarios del foro" },
        { name: "Reactions", description: "Reacciones del foro" },
        { name: "Admin", description: "Moderacion y administracion" },
        {
          name: "Admin Authentication",
          description: "Sesiones administrativas aisladas",
        },
        { name: "Realtime", description: "Eventos Server-Sent Events" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
          aiIngestKey: {
            type: "apiKey",
            in: "header",
            name: "X-AI-Ingest-Key",
          },
        },
      },
    },
    transform: jsonSchemaTransform,
    transformObject: jsonSchemaTransformObject,
  });
  await app.register(swaggerUi, {
    routePrefix: "/docs",
    staticCSP: true,
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
    },
  });

  await app.register(databasePlugin, {
    client: database?.client,
    db: database?.db,
  });

  setErrorHandlers(app);
  await registerRoutes(app, { googleIdentityProvider });

  app.addHook("onResponse", async (request, reply) => {
    request.log.info(
      {
        requestId: request.id,
        method: request.method,
        route: request.routeOptions?.url,
        statusCode: reply.statusCode,
        responseTimeMs: Math.round(reply.elapsedTime),
      },
      "request completed",
    );
  });

  return app;
}
