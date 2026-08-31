import { MongoClient, ObjectId } from "mongodb";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import { seedSuperadmin } from "../../scripts/seed-superadmin.js";
import { buildApp } from "../../src/app/app.js";
import { initializeDatabase } from "../../src/shared/database/initialize.js";
import { createTestConfig } from "../helpers/test-config.js";

const databaseName = "ciudadaniaseguraya_test_e2e";
const adminCredentials = {
  email: "e2e-admin@example.test",
  username: "e2e_admin",
  password: "Clave-Administrador-2026",
};
const aiIngestApiKey = "i".repeat(32);
const config = createTestConfig(databaseName, {
  SUPERADMIN_EMAIL: adminCredentials.email,
  SUPERADMIN_USERNAME: adminCredentials.username,
  SUPERADMIN_PASSWORD: adminCredentials.password,
  SUPERADMIN_DISPLAY_NAME: "Superadmin E2E",
  AI_INGEST_API_KEY: aiIngestApiKey,
});
const client = new MongoClient(config.mongodbUri);
const googleIdentities = new Map();
const googleIdentityProvider = {
  async verifyCredential(credential) {
    const identity = googleIdentities.get(credential);
    if (!identity) {
      throw new Error("Credencial Google de prueba desconocida");
    }
    return identity;
  },
};

let app;
let cityId;
let adminAccessToken;
let statisticsH3Index;
let sequence = 0;

function refreshCookie(response) {
  const rawHeader = response.headers["set-cookie"];
  const values = Array.isArray(rawHeader) ? rawHeader : [rawHeader];
  const cookie = values.find((value) => value?.startsWith("csy_refresh="));

  expect(cookie).toBeDefined();
  return cookie.split(";")[0];
}

async function registerUser(prefix = "user") {
  sequence += 1;
  const suffix = `${Date.now().toString(36)}_${sequence}`;
  const credentials = {
    email: `${prefix}-${suffix}@example.test`,
    username: `${prefix}_${suffix}`,
    password: "Clave-Segura-2026",
  };
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/auth/register",
    remoteAddress: `10.0.0.${sequence}`,
    payload: credentials,
  });
  expect(response.statusCode).toBe(201);
  return {
    credentials,
    refreshCookie: refreshCookie(response),
    ...response.json().data,
  };
}

function bearer(accessToken) {
  return {
    authorization: `Bearer ${accessToken}`,
  };
}

describe.sequential("API completa", () => {
  beforeAll(async () => {
    await client.connect();
    await initializeDatabase({ config, client });
    const db = client.db(databaseName);
    await Promise.all(
      [
        "users",
        "refresh_tokens",
        "admin_refresh_tokens",
        "admin_role_requests",
        "incidents",
        "incident_reports",
        "incident_confirmations",
        "hex_monthly_stats",
        "posts",
        "comments",
        "reactions",
        "audit_logs",
      ].map((name) => db.collection(name).deleteMany({})),
    );
    await seedSuperadmin({ config, client });
    app = await buildApp({
      config,
      database: { client, db },
      googleIdentityProvider,
    });
    cityId = (
      await db.collection("cities").findOne({ slug: "bogota" })
    )._id.toHexString();
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/admin/auth/login",
      payload: {
        identifier: adminCredentials.username,
        password: adminCredentials.password,
      },
    });
    adminAccessToken = login.json().data.accessToken;
  });

  afterAll(async () => {
    await app?.close();
    await client.close();
  });

  it("expone salud, disponibilidad y OpenAPI", async () => {
    const [health, ready, openapi] = await Promise.all([
      app.inject({ method: "GET", url: "/health" }),
      app.inject({ method: "GET", url: "/ready" }),
      app.inject({ method: "GET", url: "/docs/json" }),
    ]);

    expect(health.statusCode).toBe(200);
    expect(ready.statusCode).toBe(200);
    expect(openapi.statusCode).toBe(200);

    const document = openapi.json();
    const httpMethods = new Set(["get", "post", "put", "patch", "delete"]);
    const operations = Object.entries(document.paths).flatMap(
      ([path, pathItem]) =>
        Object.entries(pathItem)
          .filter(([method]) => httpMethods.has(method))
          .map(([method, operation]) => ({ method, operation, path })),
    );
    const operationsWithoutDocumentation = operations
      .filter(
        ({ operation }) =>
          !operation.summary ||
          !operation.description ||
          Object.keys(operation.responses ?? {}).length === 0,
      )
      .map(({ method, path }) => `${method.toUpperCase()} ${path}`);

    expect(Object.keys(document.paths).length).toBeGreaterThanOrEqual(41);
    expect(operationsWithoutDocumentation).toEqual([]);
    expect(document.paths["/api/v1/auth/google"].post).toBeDefined();
    expect(document.paths["/api/v1/auth/google/link"].post).toBeDefined();
    expect(document.paths["/api/v1/geolocation/cities"].get).toBeDefined();
    expect(document.paths["/api/v1/statistics/overview"].get).toBeDefined();
    expect(document.paths["/api/v1/statistics/timeseries"].get).toBeDefined();
    expect(document.paths["/api/v1/statistics/hourly"].get).toBeDefined();
    expect(document.paths["/api/v1/statistics/types"].get).toBeDefined();
    expect(
      document.paths["/api/v1/integrations/ai/incidents"].post,
    ).toBeDefined();
    expect(
      document.paths[
        "/api/v1/geolocation/hexagons/{h3Index}/statistics"
      ].get,
    ).toBeDefined();
    expect(document.components.securitySchemes.bearerAuth).toMatchObject({
      type: "http",
      scheme: "bearer",
      bearerFormat: "JWT",
    });
    expect(document.components.securitySchemes.aiIngestKey).toMatchObject({
      type: "apiKey",
      in: "header",
      name: "X-AI-Ingest-Key",
    });
    expect(JSON.stringify(document)).toContain('"example"');
  });

  it("ingiere un incidente IA pendiente sin fingir un usuario", async () => {
    const payload = {
      cityId,
      incidentType: "hurto",
      title: "Incidente detectado por el scraper E2E",
      description:
        "Una fuente periodistica reporto el incidente con detalle suficiente.",
      occurredAt: new Date(Date.now() - 10 * 60_000).toISOString(),
      latitude: 4.651,
      longitude: -74.101,
      address: "Carrera 10 con calle 20",
      locationPrecision: "approximate",
      neighborhood: "Centro",
      sourceUrl: "https://example.com/noticia-e2e-ia",
      evidenceDescription: "Nota periodistica revisable por moderacion.",
      confirmLocation: true,
    };
    const unauthenticated = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/ai/incidents",
      payload,
    });
    const unconfirmed = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/ai/incidents",
      headers: { "x-ai-ingest-key": aiIngestApiKey },
      payload: { ...payload, confirmLocation: false },
    });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/ai/incidents",
      headers: { "x-ai-ingest-key": aiIngestApiKey },
      payload,
    });
    const incident = created.json().data;
    const stored = await client
      .db(databaseName)
      .collection("incidents")
      .findOne({ _id: new ObjectId(incident.id) });
    const [reportCount, confirmationCount] = await Promise.all([
      client
        .db(databaseName)
        .collection("incident_reports")
        .countDocuments({ incidentId: stored._id }),
      client
        .db(databaseName)
        .collection("incident_confirmations")
        .countDocuments({ incidentId: stored._id }),
    ]);
    const adminDetail = await app.inject({
      method: "GET",
      url: `/api/v1/admin/incidents/${incident.id}`,
      headers: bearer(adminAccessToken),
    });

    expect(unauthenticated.statusCode).toBe(401);
    expect(unconfirmed.statusCode).toBe(400);
    expect(created.statusCode, JSON.stringify(created.json())).toBe(201);
    expect(incident).toMatchObject({
      status: "pending",
      submissionSource: "ai_scraper",
      locationConfirmed: true,
      evidenceDescription: payload.evidenceDescription,
      reporter: { source: "ai_scraper" },
    });
    expect(stored).toMatchObject({
      submissionSource: "ai_scraper",
      locationConfirmed: true,
      evidenceDescription: payload.evidenceDescription,
      createdBy: null,
      createdByRole: null,
    });
    expect(reportCount).toBe(0);
    expect(confirmationCount).toBe(0);
    expect(adminDetail.statusCode).toBe(200);
    expect(adminDetail.json().data).toMatchObject({
      submissionSource: "ai_scraper",
      evidenceDescription: payload.evidenceDescription,
    });
  });

  it("registra, evita duplicados, inicia sesion y rota refresh tokens", async () => {
    const user = await registerUser("auth");
    const duplicateEmail = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        ...user.credentials,
        username: `${user.credentials.username}_other`,
      },
    });
    const duplicateUsername = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        ...user.credentials,
        email: `other-${user.credentials.email}`,
      },
    });
    const wrongPassword = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        identifier: user.credentials.email,
        password: "Clave-Incorrecta-2026",
      },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        identifier: user.credentials.email,
        password: user.credentials.password,
      },
    });
    const refresh = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: {
        cookie: user.refreshCookie,
      },
    });
    const replay = await app.inject({
      method: "POST",
      url: "/api/v1/auth/refresh",
      headers: {
        cookie: user.refreshCookie,
      },
    });

    expect(duplicateEmail.statusCode).toBe(409);
    expect(duplicateUsername.statusCode).toBe(409);
    expect(wrongPassword.statusCode).toBe(401);
    expect(login.statusCode).toBe(200);
    expect(login.json().data).not.toHaveProperty("refreshToken");
    expect(refresh.statusCode).toBe(200);
    expect(replay.statusCode).toBe(401);
  });

  it("crea, inicia y vincula cuentas Google sin exponer refresh", async () => {
    const newCredential = `google-new-${Date.now()}`.padEnd(120, "x");
    googleIdentities.set(newCredential, {
      subject: `subject-new-${Date.now()}`,
      email: `google-new-${Date.now()}@example.test`,
      name: "Google New",
    });
    const created = await app.inject({
      method: "POST",
      url: "/api/v1/auth/google",
      payload: { credential: newCredential },
    });
    const repeated = await app.inject({
      method: "POST",
      url: "/api/v1/auth/google",
      payload: { credential: newCredential },
    });

    expect(created.statusCode).toBe(200);
    expect(refreshCookie(created)).toMatch(/^csy_refresh=/);
    expect(created.json().data).not.toHaveProperty("refreshToken");
    expect(created.json().data.user.authProviders).toEqual(["google"]);
    expect(repeated.json().data.user.id).toBe(created.json().data.user.id);

    const local = await registerUser("google_link");
    const linkCredential = `google-link-${Date.now()}`.padEnd(120, "y");
    googleIdentities.set(linkCredential, {
      subject: `subject-link-${Date.now()}`,
      email: local.credentials.email,
      name: "Google Link",
    });
    const conflict = await app.inject({
      method: "POST",
      url: "/api/v1/auth/google",
      payload: { credential: linkCredential },
    });
    const linked = await app.inject({
      method: "POST",
      url: "/api/v1/auth/google/link",
      headers: bearer(local.accessToken),
      payload: { credential: linkCredential },
    });

    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error.code).toBe(
      "GOOGLE_ACCOUNT_LINK_REQUIRED",
    );
    expect(linked.statusCode).toBe(200);
    expect(linked.json().data.authProviders).toEqual([
      "password",
      "google",
    ]);
  });

  it("valida un incidente con tres usuarios y actualiza una sola vez H3", async () => {
    const users = await Promise.all([
      registerUser("incident_a"),
      registerUser("incident_b"),
      registerUser("incident_c"),
    ]);
    const occurredAt = new Date(Date.now() - 10 * 60_000).toISOString();
    const invalidLatitude = await app.inject({
      method: "POST",
      url: "/api/v1/incidents/reports",
      headers: bearer(users[0].accessToken),
      payload: {
        cityId,
        incidentType: "robo",
        title: "Coordenada invalida",
        description: "Descripcion valida para probar una latitud incorrecta.",
        occurredAt,
        latitude: 91,
        longitude: -74.083,
      },
    });
    const invalidLongitude = await app.inject({
      method: "POST",
      url: "/api/v1/incidents/reports",
      headers: bearer(users[0].accessToken),
      payload: {
        cityId,
        incidentType: "robo",
        title: "Coordenada invalida",
        description: "Descripcion valida para probar longitud incorrecta.",
        occurredAt,
        latitude: 4.6515,
        longitude: -181,
      },
    });
    const report = await app.inject({
      method: "POST",
      url: "/api/v1/incidents/reports",
      headers: bearer(users[0].accessToken),
      payload: {
        cityId,
        incidentType: "robo",
        title: "Reporte comunitario e2e",
        description:
          "Reporte comunitario con informacion suficiente para integracion.",
        occurredAt,
        latitude: 4.6515,
        longitude: -74.083,
        neighborhood: "Pruebas",
      },
    });
    const incident = report.json().data;
    const duplicate = await app.inject({
      method: "POST",
      url: `/api/v1/incidents/${incident.id}/confirm`,
      headers: bearer(users[0].accessToken),
    });
    const second = await app.inject({
      method: "POST",
      url: `/api/v1/incidents/${incident.id}/confirm`,
      headers: bearer(users[1].accessToken),
    });
    const third = await app.inject({
      method: "POST",
      url: `/api/v1/incidents/${incident.id}/confirm`,
      headers: bearer(users[2].accessToken),
    });
    const stat = await client
      .db(databaseName)
      .collection("hex_monthly_stats")
      .findOne({
        h3Resolution: 9,
        h3Index: incident.h3Index,
      });

    expect(invalidLatitude.statusCode).toBe(400);
    expect(invalidLongitude.statusCode).toBe(400);
    expect(report.statusCode).toBe(201);
    expect(incident.verification.confirmationCount).toBe(1);
    expect(duplicate.statusCode).toBe(409);
    expect(second.json().data.status).toBe("pending");
    expect(third.json().data.status).toBe("community_confirmed");
    expect(stat.incidentCount).toBe(1);
    expect(stat.incidentTypes.robo).toBe(1);

    const suspended = await registerUser("suspended");
    const suspension = await app.inject({
      method: "POST",
      url: `/api/v1/admin/users/${suspended.user.id}/suspend`,
      headers: bearer(adminAccessToken),
      payload: {
        reason: "Cuenta suspendida para comprobar la revocacion inmediata.",
      },
    });
    expect(suspension.statusCode).toBe(200);
    const blockedConfirmation = await app.inject({
      method: "POST",
      url: `/api/v1/incidents/${incident.id}/confirm`,
      headers: bearer(suspended.accessToken),
    });
    expect(blockedConfirmation.statusCode).toBe(403);

    const rejected = await app.inject({
      method: "POST",
      url: `/api/v1/admin/incidents/${incident.id}/reject`,
      headers: bearer(adminAccessToken),
      payload: {
        reasonCode: "insufficient_evidence",
        reason: "La evidencia disponible no permite validar el incidente.",
        expectedUpdatedAt: third.json().data.updatedAt,
      },
    });
    const statAfterReject = await client
      .db(databaseName)
      .collection("hex_monthly_stats")
      .findOne({ _id: stat._id });
    expect(rejected.statusCode, JSON.stringify(rejected.json())).toBe(200);
    expect(rejected.json().data.status).toBe("rejected");
    expect(statAfterReject.incidentCount).toBe(0);
  });

  it("crea y fusiona incidentes administrativos sin duplicar estadisticas", async () => {
    const occurredAt = new Date(Date.now() - 5 * 60_000).toISOString();
    const payload = {
      cityId,
      incidentType: "vandalismo",
      title: "Incidente administrativo principal",
      description:
        "Incidente administrativo con detalle suficiente para fusion.",
      occurredAt,
      latitude: 4.7001,
      longitude: -74.1001,
      locationPrecision: "approximate",
    };
    const first = await app.inject({
      method: "POST",
      url: "/api/v1/admin/incidents",
      headers: bearer(adminAccessToken),
      payload,
    });
    const second = await app.inject({
      method: "POST",
      url: "/api/v1/admin/incidents",
      headers: bearer(adminAccessToken),
      payload: { ...payload, title: "Incidente administrativo duplicado" },
    });
    const primary = first.json().data;
    const secondary = second.json().data;
    const before = await client
      .db(databaseName)
      .collection("hex_monthly_stats")
      .findOne({
        h3Resolution: 9,
        h3Index: primary.h3Index,
      });
    const merged = await app.inject({
      method: "POST",
      url: `/api/v1/admin/incidents/${primary.id}/merge`,
      headers: bearer(adminAccessToken),
      payload: {
        secondaryIncidentId: secondary.id,
        reason: "Ambos registros describen el mismo incidente verificado.",
        expectedUpdatedAt: primary.updatedAt,
        secondaryExpectedUpdatedAt: secondary.updatedAt,
      },
    });
    const after = await client
      .db(databaseName)
      .collection("hex_monthly_stats")
      .findOne({ _id: before._id });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(before.incidentCount).toBe(2);
    expect(merged.statusCode).toBe(200);
    expect(after.incidentCount).toBe(1);
    statisticsH3Index = primary.h3Index;
  });

  it("agrega estadisticas publicas por periodo, tipo y hexagono", async () => {
    const query =
      `cityId=${cityId}` +
      "&from=2020-01-01T00%3A00%3A00.000Z" +
      "&to=2035-01-01T00%3A00%3A00.000Z" +
      "&incidentType=vandalismo" +
      "&timezone=America%2FBogota";
    const [
      overview,
      timeseries,
      hourly,
      types,
      hexagon,
      annualHeatmap,
      annualHexagon,
    ] = await Promise.all([
      app.inject({
        method: "GET",
        url: `/api/v1/statistics/overview?${query}`,
      }),
      app.inject({
        method: "GET",
        url: `/api/v1/statistics/timeseries?${query}&groupBy=month`,
      }),
      app.inject({
        method: "GET",
        url: `/api/v1/statistics/hourly?${query}`,
      }),
      app.inject({
        method: "GET",
        url: `/api/v1/statistics/types?${query}`,
      }),
      app.inject({
        method: "GET",
        url:
          `/api/v1/geolocation/hexagons/${statisticsH3Index}/statistics?` +
          `${query}&groupBy=day`,
      }),
      app.inject({
        method: "GET",
        url:
          `/api/v1/geolocation/heatmap?cityId=${cityId}` +
          "&resolution=9&north=4.8&south=4.6&east=-73.9&west=-74.2",
      }),
      app.inject({
        method: "GET",
        url:
          `/api/v1/geolocation/hexagons/${statisticsH3Index}` +
          `?cityId=${cityId}`,
      }),
    ]);

    expect(
      [
        overview,
        timeseries,
        hourly,
        types,
        hexagon,
        annualHeatmap,
        annualHexagon,
      ].map(
        ({ statusCode }) => statusCode,
      ),
    ).toEqual([200, 200, 200, 200, 200, 200, 200]);
    expect(overview.json().data).toMatchObject({
      scope: { type: "city", cityId },
      totalIncidents: 1,
      validation: { adminVerified: 1 },
    });
    expect(timeseries.json().data.totalIncidents).toBe(1);
    expect(hourly.json().data).toMatchObject({
      series: expect.any(Array),
      summary: { totalIncidents: 1 },
    });
    expect(hourly.json().data.series).toHaveLength(24);
    expect(types.json().data.totalIncidents).toBe(1);
    expect(
      types
        .json()
        .data.series.find(
          ({ incidentType }) => incidentType === "vandalismo",
        ),
    ).toMatchObject({ incidentCount: 1, percentage: 100 });
    expect(hexagon.json().data).toMatchObject({
      scope: {
        type: "hexagon",
        h3Index: statisticsH3Index,
        cityId,
      },
      overview: { totalIncidents: 1 },
      timeseries: { groupBy: "day", totalIncidents: 1 },
    });
    expect(
      annualHeatmap
        .json()
        .data.find(({ h3Index }) => h3Index === statisticsH3Index),
    ).toMatchObject({
      incidentCount: 1,
      level: 1,
      color: "#22C55E",
      period: { mode: "rolling_year" },
    });
    expect(annualHexagon.json().data).toMatchObject({
      h3Index: statisticsH3Index,
      period: { mode: "rolling_year" },
      statistics: {
        incidentCount: 1,
        level: 1,
        color: "#22C55E",
      },
    });
  });

  it("aplica propiedad, comentarios y reacciones unicas en el foro", async () => {
    const author = await registerUser("forum_author");
    const visitor = await registerUser("forum_visitor");
    const postResponse = await app.inject({
      method: "POST",
      url: "/api/v1/posts",
      headers: bearer(author.accessToken),
      payload: {
        title: "Alerta comunitaria del barrio",
        content:
          "Contenido suficientemente detallado para una publicacion comunitaria.",
        tags: ["seguridad", "barrio"],
      },
    });
    const post = postResponse.json().data;
    const ownEdit = await app.inject({
      method: "PATCH",
      url: `/api/v1/posts/${post.id}`,
      headers: bearer(author.accessToken),
      payload: { title: "Alerta comunitaria actualizada" },
    });
    const foreignEdit = await app.inject({
      method: "PATCH",
      url: `/api/v1/posts/${post.id}`,
      headers: bearer(visitor.accessToken),
      payload: { title: "Edicion ajena bloqueada" },
    });
    const commentResponse = await app.inject({
      method: "POST",
      url: `/api/v1/posts/${post.id}/comments`,
      headers: bearer(visitor.accessToken),
      payload: { content: "Comentario ciudadano de apoyo." },
    });
    const comment = commentResponse.json().data;
    const reaction = await app.inject({
      method: "POST",
      url: `/api/v1/posts/${post.id}/reactions`,
      headers: bearer(visitor.accessToken),
      payload: { reactionType: "helpful" },
    });
    const duplicate = await app.inject({
      method: "POST",
      url: `/api/v1/posts/${post.id}/reactions`,
      headers: bearer(visitor.accessToken),
      payload: { reactionType: "helpful" },
    });
    const commentReaction = await app.inject({
      method: "POST",
      url: `/api/v1/comments/${comment.id}/reactions`,
      headers: bearer(author.accessToken),
      payload: { reactionType: "like" },
    });
    const detail = await app.inject({
      method: "GET",
      url: `/api/v1/posts/${post.id}`,
    });

    expect(postResponse.statusCode).toBe(201);
    expect(ownEdit.statusCode).toBe(200);
    expect(foreignEdit.statusCode).toBe(403);
    expect(commentResponse.statusCode).toBe(201);
    expect(reaction.statusCode).toBe(201);
    expect(duplicate.statusCode).toBe(409);
    expect(commentReaction.statusCode).toBe(201);
    expect(detail.json().data).toMatchObject({
      commentCount: 1,
      reactionCount: 1,
    });
  });

  it("entrega SSE, replay y limpia la conexion", async () => {
    const first = app.eventBus.publish("heatmap.updated", { sequence: 1 });
    app.eventBus.publish("post.created", { sequence: 2 });
    await app.listen({ host: "127.0.0.1", port: 0 });
    const { port } = app.server.address();
    const abortController = new AbortController();
    const response = await fetch(
      `http://127.0.0.1:${port}/api/v1/events/stream?clientId=e2e-sse-client`,
      {
        headers: {
          accept: "text/event-stream",
          "last-event-id": first.id,
        },
        signal: abortController.signal,
      },
    );
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let received = "";

    while (!received.includes("event: post.created")) {
      const chunk = await reader.read();
      expect(chunk.done).toBe(false);
      received += decoder.decode(chunk.value, { stream: true });
    }

    app.eventBus.publish("comment.created", { sequence: 3 });
    while (!received.includes("event: comment.created")) {
      const chunk = await reader.read();
      expect(chunk.done).toBe(false);
      received += decoder.decode(chunk.value, { stream: true });
    }

    abortController.abort();
    await reader.cancel().catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain(
      "text/event-stream",
    );
    expect(app.eventBus.listenerCount()).toBe(0);
  });
});
