const ADMIN = Object.freeze({
  id: "74b7f0e4a1c2d3e4f5a6b7d0",
  username: "admin_e2e",
  displayName: "Administradora E2E",
  role: "admin",
  status: "active",
  lastLoginAt: "2026-07-29T08:00:00.000Z",
  permissions: [
    "admin.dashboard.read",
    "users.read",
    "users.update",
    "users.suspend",
    "users.delete",
    "admins.read",
    "adminRequests.create",
    "adminRequests.read",
    "incidents.read",
    "incidents.approve",
    "incidents.reject",
    "incidents.update",
    "incidents.merge",
    "posts.moderate",
    "comments.moderate",
    "audit.readOwn",
    "sessions.revoke",
  ],
});

function envelope(data, meta = {}) {
  return {
    success: true,
    data,
    meta: { requestId: "request-admin-e2e", ...meta },
  };
}

function errorEnvelope(code, message) {
  return {
    success: false,
    error: { code, message, details: [] },
    meta: { requestId: "request-admin-e2e-error" },
  };
}

function corsHeaders(request) {
  return {
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "Authorization, Content-Type, Accept",
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "access-control-allow-origin": request.headers().origin || "http://127.0.0.1:3100",
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

export async function installMockAdminPlatform(page) {
  const state = {
    authenticated: false,
    requests: [],
    received: { login: [], logout: [] },
    pageErrors: [],
  };

  page.on("pageerror", (error) => state.pageErrors.push(error.message));

  await page.route("**/api/v1/admin/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const body = await requestBody(request);
    const authorization = request.headers().authorization || null;
    const headers = corsHeaders(request);

    state.requests.push({
      method,
      path: url.pathname,
      authorization,
      body,
    });

    const json = (status, payload) =>
      route.fulfill({
        status,
        contentType: "application/json",
        headers: { ...headers, "x-request-id": "request-admin-e2e" },
        body: JSON.stringify(payload),
      });

    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }

    if (url.pathname === "/api/v1/admin/auth/me") {
      if (state.authenticated && authorization?.startsWith("Bearer ")) {
        await json(200, envelope(ADMIN));
      } else {
        await json(
          401,
          errorEnvelope(
            "ADMIN_AUTHENTICATION_REQUIRED",
            "Debes iniciar sesión administrativa.",
          ),
        );
      }
      return;
    }

    if (url.pathname === "/api/v1/admin/auth/refresh") {
      if (state.authenticated) {
        await json(200, envelope({ accessToken: "admin-refreshed-e2e-token" }));
      } else {
        await json(
          401,
          errorEnvelope("INVALID_ADMIN_REFRESH_TOKEN", "No hay sesión renovable."),
        );
      }
      return;
    }

    if (url.pathname === "/api/v1/admin/auth/login") {
      state.received.login.push(body);
      state.authenticated = true;
      await json(200, envelope({ accessToken: "admin-access-e2e-token", user: ADMIN }));
      return;
    }

    if (
      url.pathname === "/api/v1/admin/auth/logout" ||
      url.pathname === "/api/v1/admin/auth/logout-all"
    ) {
      state.received.logout.push(body);
      state.authenticated = false;
      await route.fulfill({ status: 204, headers });
      return;
    }

    if (url.pathname === "/api/v1/admin/events/stream") {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        headers: { ...headers, "cache-control": "no-cache" },
        body: 'id: event-admin-e2e\nevent: admin.system.ready\ndata: {"message":"Canal listo"}\n\n',
      });
      return;
    }

    if (url.pathname === "/api/v1/admin/dashboard") {
      await json(
        200,
        envelope({
          counts: {
            pendingIncidents: 3,
            approvedToday: 2,
            rejectedToday: 1,
            activeUsers: 20,
            suspendedUsers: 1,
            activeAdministrators: 2,
            pendingRequests: 1,
            reportedComments: 4,
            pendingPosts: 5,
          },
          oldestPending: [],
          recentAudit: [],
          services: { backend: "available", realtime: "available" },
        }),
      );
      return;
    }

    await json(
      404,
      errorEnvelope(
        "E2E_ADMIN_ROUTE_NOT_FOUND",
        `No existe mock para ${method} ${url.pathname}.`,
      ),
    );
  });

  return state;
}
