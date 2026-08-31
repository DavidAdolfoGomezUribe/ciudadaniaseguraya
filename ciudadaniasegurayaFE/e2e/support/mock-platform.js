import { cellToBoundary, getResolution, gridDisk, latLngToCell } from "h3-js";

export const CITY_ID = "64b7f0e4a1c2d3e4f5a6b7c8";
export const HEXAGON_INDEX = latLngToCell(4.711, -74.0721, 9);
export const MAP_HEXAGON_INDEX = latLngToCell(4.711, -74.0721, 7);
export const APP_URL = process.env.CSY_E2E_BASE_URL || "http://127.0.0.1:3100";

const USER = Object.freeze({
  id: "74b7f0e4a1c2d3e4f5a6b7c9",
  username: "ciudadana_e2e",
  email: "ciudadana@example.com",
  role: "citizen",
  status: "active",
  emailVerified: true,
  createdAt: "2025-01-01T12:00:00.000Z",
  updatedAt: "2026-07-01T12:00:00.000Z",
  lastLoginAt: "2026-07-26T12:00:00.000Z",
});

const HEATMAP_SCALE = Object.freeze([
  {
    level: 0,
    min: 0,
    max: 0,
    color: "#2563EB",
    label: "Sin registros validados",
  },
  { level: 1, min: 1, max: 2, color: "#22C55E", label: "Nivel 1" },
  { level: 2, min: 3, max: 5, color: "#EAB308", label: "Nivel 2" },
  { level: 3, min: 6, max: 9, color: "#F97316", label: "Nivel 3" },
  { level: 4, min: 10, max: 19, color: "#EF4444", label: "Nivel 4" },
  { level: 5, min: 20, max: null, color: "#111827", label: "Nivel 5" },
]);

function session(user = USER) {
  return {
    user,
    accessToken: "e2e-access-token",
    accessTokenExpiresIn: "15m",
    refreshTokenExpiresAt: "2026-08-25T12:00:00.000Z",
  };
}

function envelope(data, requestId = "request-e2e") {
  return {
    success: true,
    data,
    meta: { requestId },
  };
}

function errorEnvelope({
  code,
  message,
  requestId = "request-e2e-error",
  details = [],
}) {
  return {
    success: false,
    error: { code, message, details },
    meta: { requestId },
  };
}

function incidentTypes() {
  return [
    {
      code: "hurto",
      name: "Hurto",
      description: "Apoderamiento de bienes sin autorización.",
      severity: 2,
    },
    {
      code: "robo",
      name: "Robo con violencia",
      description: "Apoderamiento acompañado de amenaza o violencia.",
      severity: 4,
    },
  ];
}

function city() {
  return {
    id: CITY_ID,
    name: "Bogotá",
    slug: "bogota",
    countryCode: "CO",
    timezone: "America/Bogota",
    boundary: null,
    bounds: {
      north: 4.84,
      south: 4.46,
      east: -73.85,
      west: -74.35,
    },
    center: { latitude: 4.711, longitude: -74.0721 },
  };
}

function heatmapCell(url) {
  const resolution = Number(url.searchParams.get("resolution") || 8);
  return {
    h3Index: latLngToCell(4.711, -74.0721, resolution),
    resolution,
    month: null,
    period: {
      mode: "rolling_year",
      from: "2025-07-26T12:00:00.000Z",
      to: "2026-07-26T12:00:00.000Z",
      timezone: "America/Bogota",
    },
    incidentCount: 7,
    level: 3,
    color: "#F97316",
    incidentTypes: { hurto: 5, robo: 2 },
    lastUpdatedAt: "2026-07-26T12:00:00.000Z",
  };
}

function polygonForCell(h3Index) {
  const ring = cellToBoundary(h3Index).map(([latitude, longitude]) => [
    longitude,
    latitude,
  ]);
  ring.push(ring[0]);
  return {
    type: "Polygon",
    coordinates: [ring],
  };
}

function hexagonDetail(h3Index, emptyData) {
  const statistics = emptyData
    ? null
    : {
        h3Index,
        resolution: getResolution(h3Index),
        month: null,
        period: {
          mode: "rolling_year",
          from: "2025-07-26T12:00:00.000Z",
          to: "2026-07-26T12:00:00.000Z",
          timezone: "America/Bogota",
        },
        incidentCount: 7,
        level: 3,
        color: "#F97316",
        incidentTypes: { hurto: 5, robo: 2 },
        lastUpdatedAt: "2026-07-26T12:00:00.000Z",
      };

  return {
    h3Index,
    resolution: getResolution(h3Index),
    center: { latitude: 4.711, longitude: -74.0721 },
    boundary: polygonForCell(h3Index),
    period: {
      mode: "rolling_year",
      from: "2025-07-26T12:00:00.000Z",
      to: "2026-07-26T12:00:00.000Z",
      timezone: "America/Bogota",
    },
    statistics,
    incidents: emptyData
      ? []
      : [
          {
            id: "incident-public-e2e",
            title: "Hurto validado en transporte público",
            cityName: "Bogotá",
            occurredAt: "2026-07-20T17:30:00.000Z",
            verification: { method: "community" },
            sourceUrls: ["https://example.com/noticia-validada"],
          },
        ],
  };
}

function statisticsSeries(url, emptyData) {
  if (emptyData) return [];
  const groupBy = url.searchParams.get("groupBy");
  if (url.pathname.endsWith("/hourly")) {
    return [
      { key: 8, label: "08:00", incidentCount: 2 },
      { key: 18, label: "18:00", incidentCount: 5 },
    ];
  }
  if (url.pathname.endsWith("/types")) {
    return [
      { key: "hurto", label: "Hurto", incidentCount: 5 },
      { key: "robo", label: "Robo con violencia", incidentCount: 2 },
    ];
  }
  if (groupBy === "year") {
    return [
      { key: "2025", label: "2025", incidentCount: 5 },
      { key: "2026", label: "2026", incidentCount: 7 },
    ];
  }
  if (groupBy === "month") {
    return [
      { key: "2026-06", label: "jun", incidentCount: 3 },
      { key: "2026-07", label: "jul", incidentCount: 7 },
    ];
  }
  return [
    { key: "2026-07-20", label: "20", incidentCount: 2 },
    { key: "2026-07-21", label: "21", incidentCount: 5 },
  ];
}

function hexagonStatistics(url, emptyData) {
  const series = statisticsSeries(url, emptyData);
  const total = emptyData ? 0 : 7;
  const lastUpdatedAt = emptyData ? null : "2026-07-26T12:00:00.000Z";
  const h3Index = decodeURIComponent(url.pathname.split("/").at(-2));
  const neighborIndex =
    gridDisk(h3Index, 1).find((index) => index !== h3Index) || h3Index;
  return {
    scope: { cityId: CITY_ID },
    period: {
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
    },
    overview: {
      totalIncidents: total,
      validation: {
        communityConfirmed: emptyData ? 0 : 5,
        adminVerified: emptyData ? 0 : 2,
      },
      lastUpdatedAt,
      comparison: {
        previousIncidentCount: emptyData ? 0 : 4,
        absoluteChange: emptyData ? 0 : 3,
        percentageChange: emptyData ? null : 75,
      },
    },
    timeseries: {
      scope: { cityId: CITY_ID },
      series,
      total,
      lastUpdatedAt,
    },
    hourly: {
      series: emptyData
        ? []
        : [
            { key: 8, label: "08:00", incidentCount: 2 },
            { key: 18, label: "18:00", incidentCount: 5 },
          ],
      lastUpdatedAt,
      summary: {
        totalIncidents: total,
        averagePerHour: emptyData ? 0 : 0.29,
        busiestHours: emptyData ? [] : [18],
        quietestHours: emptyData ? [] : [3],
      },
    },
    types: {
      scope: { cityId: CITY_ID },
      series: emptyData
        ? []
        : [
            { key: "hurto", label: "Hurto", incidentCount: 5 },
            { key: "robo", label: "Robo con violencia", incidentCount: 2 },
          ],
      total,
      lastUpdatedAt,
    },
    nearbyComparison: {
      center: { h3Index, incidentCount: total },
      neighbors: [
        {
          h3Index: neighborIndex,
          incidentCount: emptyData ? 0 : 4,
        },
      ],
      averageNeighborCount: emptyData ? 0 : 4,
      absoluteDifference: emptyData ? 0 : 3,
      percentageDifference: emptyData ? null : 75,
      lastUpdatedAt,
    },
  };
}

function corsHeaders(request) {
  return {
    "access-control-allow-credentials": "true",
    "access-control-allow-headers":
      request.headers().origin === undefined
        ? "*"
        : "Authorization, Content-Type, Accept",
    "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "access-control-allow-origin": request.headers().origin || "http://127.0.0.1:3000",
    "access-control-expose-headers": "X-Request-Id",
  };
}

async function requestBody(request) {
  try {
    return request.postDataJSON();
  } catch {
    return request.postData();
  }
}

async function installFakeRealtime(page) {
  await page.addInitScript(() => {
    const sources = [];

    class ControlledEventSource {
      constructor(url) {
        this.url = url;
        this.readyState = 0;
        this.listeners = new Map();
        this.closed = false;
        sources.push(this);
        window.setTimeout(() => {
          if (this.closed) return;
          this.readyState = 1;
          this.onopen?.(new Event("open"));
        }, 0);
      }

      addEventListener(type, listener) {
        const listeners = this.listeners.get(type) || [];
        listeners.push(listener);
        this.listeners.set(type, listeners);
      }

      close() {
        this.closed = true;
        this.readyState = 2;
      }

      emit(type, payload) {
        if (this.closed) return;
        const event = {
          data: JSON.stringify(payload),
          lastEventId: payload.id || "",
          type,
        };
        for (const listener of this.listeners.get(type) || []) {
          listener(event);
        }
      }
    }

    Object.defineProperty(window, "EventSource", {
      configurable: true,
      writable: true,
      value: ControlledEventSource,
    });

    window.__csyEmitRealtime = (type, payload) => {
      for (const source of sources) source.emit(type, payload);
    };
  });
}

export async function emitRealtime(page, type, payload) {
  await page.evaluate(
    ({ eventType, eventPayload }) => {
      window.__csyEmitRealtime(eventType, eventPayload);
    },
    { eventType: type, eventPayload: payload },
  );
}

export async function installMockPlatform(page, options = {}) {
  const state = {
    authenticated: Boolean(options.authenticated),
    consoleErrors: [],
    googleRequests: [],
    mapTileRequests: [],
    pageErrors: [],
    received: {
      login: [],
      logout: [],
      register: [],
      reports: [],
    },
    requests: [],
  };

  page.on("console", (message) => {
    if (message.type() === "error") state.consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => {
    state.pageErrors.push(error.message);
  });

  await installFakeRealtime(page);

  await page.route("https://tile.openstreetmap.org/**", async (route) => {
    state.mapTileRequests.push(route.request().url());
    if (options.mapTilesUnavailable) {
      await route.abort("failed");
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      headers: { "cache-control": "public, max-age=604800" },
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  });

  await page.route(
    /https:\/\/(?:accounts\.google\.com|maps\.googleapis\.com)\/.*/,
    async (route) => {
      state.googleRequests.push(route.request().url());
      await route.abort("blockedbyclient");
    },
  );
  await page.route(/https:\/\/maps\.gstatic\.com\/.*/, async (route) => {
    state.googleRequests.push(route.request().url());
    await route.abort("blockedbyclient");
  });

  await page.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const body = await requestBody(request);
    state.requests.push({
      method,
      path: url.pathname,
      url: url.href,
      body,
      authorization: request.headers().authorization || null,
    });
    const headers = corsHeaders(request);

    const json = async (status, payload, requestId = "request-e2e") => {
      await route.fulfill({
        status,
        contentType: "application/json",
        headers: { ...headers, "x-request-id": requestId },
        body: JSON.stringify(payload),
      });
    };

    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }

    if (url.pathname === "/api/v1/auth/me") {
      if (
        state.authenticated &&
        request.headers().authorization?.startsWith("Bearer ")
      ) {
        await json(200, envelope(USER, "request-me"));
      } else {
        await json(
          401,
          errorEnvelope({
            code: "AUTHENTICATION_REQUIRED",
            message: state.authenticated
              ? "La sesión requiere renovación."
              : "Debes iniciar sesión.",
            requestId: state.authenticated
              ? "request-me-refresh"
              : "request-me-anonymous",
          }),
        );
      }
      return;
    }

    if (url.pathname === "/api/v1/auth/refresh") {
      if (state.authenticated) {
        await json(
          200,
          envelope({ accessToken: "e2e-refreshed-token" }, "request-refresh"),
        );
      } else {
        await json(
          401,
          errorEnvelope({
            code: "INVALID_REFRESH_TOKEN",
            message: "No existe una sesión renovable.",
            requestId: "request-refresh-anonymous",
          }),
        );
      }
      return;
    }

    if (url.pathname === "/api/v1/auth/login") {
      state.received.login.push(body);
      if (options.loginError) {
        await json(
          401,
          errorEnvelope({
            code: "INVALID_CREDENTIALS",
            message: "Credenciales inválidas.",
            requestId: "request-login-error",
          }),
        );
        return;
      }
      state.authenticated = true;
      await json(200, envelope(session(), "request-login"));
      return;
    }

    if (url.pathname === "/api/v1/auth/register") {
      state.received.register.push(body);
      if (options.registerError) {
        await json(
          409,
          errorEnvelope({
            code: "EMAIL_ALREADY_EXISTS",
            message: "El correo ya está registrado.",
            requestId: "request-register-error",
          }),
        );
        return;
      }
      state.authenticated = true;
      await json(201, envelope(session(), "request-register"));
      return;
    }

    if (url.pathname === "/api/v1/auth/logout") {
      state.received.logout.push(body);
      state.authenticated = false;
      await route.fulfill({ status: 204, headers });
      return;
    }

    if (url.pathname === "/api/v1/geolocation/cities") {
      await json(200, envelope([city()], "request-cities"));
      return;
    }

    if (url.pathname === "/api/v1/geolocation/config") {
      await json(
        200,
        envelope(
          {
            h3BaseResolution: 9,
            h3SupportedResolutions: [4, 5, 6, 7, 8, 9],
            heatmapScale: HEATMAP_SCALE,
          },
          "request-map-config",
        ),
      );
      return;
    }

    if (url.pathname === "/api/v1/geolocation/heatmap") {
      await json(
        200,
        envelope(options.emptyData ? [] : [heatmapCell(url)], "request-heatmap"),
      );
      return;
    }

    if (
      url.pathname.startsWith("/api/v1/geolocation/hexagons/") &&
      url.pathname.endsWith("/statistics")
    ) {
      await json(
        200,
        envelope(
          hexagonStatistics(url, options.emptyData),
          "request-hexagon-statistics",
        ),
      );
      return;
    }

    if (url.pathname.startsWith("/api/v1/geolocation/hexagons/")) {
      const h3Index = decodeURIComponent(url.pathname.split("/").at(-1));
      await json(
        200,
        envelope(hexagonDetail(h3Index, options.emptyData), "request-hexagon"),
      );
      return;
    }

    if (url.pathname === "/api/v1/incidents/types") {
      await json(200, envelope(incidentTypes(), "request-types"));
      return;
    }

    if (url.pathname === "/api/v1/incidents/reports") {
      state.received.reports.push(body);
      if (!state.authenticated) {
        await json(
          401,
          errorEnvelope({
            code: "AUTHENTICATION_REQUIRED",
            message: "Debes iniciar sesión.",
            requestId: "request-report-anonymous",
          }),
        );
        return;
      }
      await json(
        201,
        envelope(
          {
            id: "report-e2e",
            status: "pending",
            validationMethod: "community",
          },
          "request-report",
        ),
      );
      return;
    }

    if (url.pathname.startsWith("/api/v1/statistics/")) {
      await json(
        200,
        envelope(
          {
            scope: { cityId: CITY_ID },
            period: {
              from: url.searchParams.get("from"),
              to: url.searchParams.get("to"),
            },
            series: statisticsSeries(url, options.emptyData),
            total: options.emptyData ? 0 : 7,
            lastUpdatedAt: "2026-07-26T12:00:00.000Z",
          },
          "request-statistics",
        ),
      );
      return;
    }

    await json(
      404,
      errorEnvelope({
        code: "E2E_ROUTE_NOT_FOUND",
        message: `No existe mock para ${method} ${url.pathname}.`,
        requestId: "request-route-not-found",
      }),
    );
  });

  return state;
}
