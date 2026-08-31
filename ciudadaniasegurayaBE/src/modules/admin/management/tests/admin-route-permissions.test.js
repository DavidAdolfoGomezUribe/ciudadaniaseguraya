import { describe, expect, it, vi } from "vitest";

import { registerCommentRoutes } from "../../../forum/comments/routes/comment.routes.js";
import { registerPostRoutes } from "../../../forum/posts/routes/post.routes.js";
import { registerIncidentRoutes } from "../../../incidents/routes/incident.routes.js";
import { registerAdminManagementRoutes } from "../routes/admin-management.routes.js";
import { registerAgentControlRoutes } from "../../agent-control/routes/agent-control.routes.js";

function createRouteCollector() {
  const routes = [];
  const app = {};

  for (const method of ["get", "post", "patch", "delete"]) {
    app[method] = (path, options, handler) => {
      routes.push({ method: method.toUpperCase(), path, options, handler });
    };
  }

  return { app, routes };
}

function controllerStub() {
  return new Proxy(
    {},
    {
      get() {
        return vi.fn();
      },
    },
  );
}

function permissionGuard(permission) {
  const guard = vi.fn();
  guard.permission = permission;
  guard.authenticatesAdmin = true;
  return guard;
}

function routeKey(route) {
  return `${route.method} ${route.path}`;
}

function configuredPermission(route) {
  const handlers = Array.isArray(route.options.preHandler)
    ? route.options.preHandler
    : [route.options.preHandler];
  return handlers.find((handler) => handler?.permission)?.permission;
}

describe("contrato de permisos de rutas administrativas", () => {
  it("protege todas las rutas operativas con su permiso explicito", async () => {
    const { app, routes } = createRouteCollector();
    const authenticate = vi.fn();
    const authenticateAdmin = vi.fn();
    const requirePermission = vi.fn(permissionGuard);

    await registerAdminManagementRoutes(app, {
      controller: controllerStub(),
      authenticate,
      authenticateAdmin,
      requirePermission,
    });
    await registerAgentControlRoutes(app, {
      controller: controllerStub(),
      authenticateAdmin,
      requirePermission,
    });
    await registerIncidentRoutes(app, {
      controller: controllerStub(),
      authenticate,
      requireAdmin: authenticateAdmin,
      requirePermission,
    });
    await registerPostRoutes(app, {
      controller: controllerStub(),
      authenticate,
      requireAdmin: authenticateAdmin,
      requirePermission,
    });
    await registerCommentRoutes(app, {
      controller: controllerStub(),
      authenticate,
      requireAdmin: authenticateAdmin,
      requirePermission,
    });

    const expected = new Map([
      ["GET /api/v1/admin/dashboard", "admin.dashboard.read"],
      ["GET /api/v1/admin/users", "users.read"],
      ["GET /api/v1/admin/users/:userId", "users.read"],
      ["PATCH /api/v1/admin/users/:userId", "users.update"],
      ["POST /api/v1/admin/users/:userId/suspend", "users.suspend"],
      ["POST /api/v1/admin/users/:userId/reactivate", "users.suspend"],
      ["POST /api/v1/admin/users/:userId/revoke-sessions", "sessions.revoke"],
      ["DELETE /api/v1/admin/users/:userId", "users.delete"],
      ["GET /api/v1/admin/administrators", "admins.read"],
      ["GET /api/v1/admin/administrators/:adminId", "admins.read"],
      ["POST /api/v1/admin/users/:userId/promote", "admins.promote"],
      [
        "POST /api/v1/admin/administrators/:adminId/demote",
        "admins.demote",
      ],
      [
        "POST /api/v1/admin/administrators/:adminId/suspend",
        "admins.suspend",
      ],
      [
        "POST /api/v1/admin/administrators/:adminId/reactivate",
        "admins.suspend",
      ],
      [
        "POST /api/v1/admin/administrators/:adminId/revoke-sessions",
        "admins.update",
      ],
      [
        "POST /api/v1/admin/admin-role-requests",
        "adminRequests.create",
      ],
      [
        "GET /api/v1/admin/admin-role-requests/mine",
        "adminRequests.create",
      ],
      ["GET /api/v1/admin/admin-role-requests", "adminRequests.read"],
      [
        "GET /api/v1/admin/admin-role-requests/:requestId",
        "adminRequests.read",
      ],
      [
        "POST /api/v1/admin/admin-role-requests/:requestId/approve",
        "adminRequests.resolve",
      ],
      [
        "POST /api/v1/admin/admin-role-requests/:requestId/reject",
        "adminRequests.resolve",
      ],
      [
        "POST /api/v1/admin/admin-role-requests/:requestId/request-information",
        "adminRequests.resolve",
      ],
      ["GET /api/v1/admin/audit", "audit.readOwn"],
      ["GET /api/v1/admin/settings", "settings.read"],
      ["PATCH /api/v1/admin/settings", "settings.update"],
      ["GET /api/v1/admin/agent", "agent.control"],
      ["POST /api/v1/admin/agent/runs", "agent.control"],
      [
        "POST /api/v1/admin/agent/runs/:runId/cancel",
        "agent.control",
      ],
      ["POST /api/v1/admin/incidents", "incidents.createVerified"],
      ["GET /api/v1/admin/incidents", "incidents.read"],
      ["GET /api/v1/admin/incidents/:incidentId", "incidents.read"],
      ["PATCH /api/v1/admin/incidents/:incidentId", "incidents.update"],
      [
        "POST /api/v1/admin/incidents/:incidentId/approve",
        "incidents.approve",
      ],
      [
        "POST /api/v1/admin/incidents/:incidentId/reject",
        "incidents.reject",
      ],
      [
        "POST /api/v1/admin/incidents/:incidentId/merge",
        "incidents.merge",
      ],
      [
        "POST /api/v1/admin/incidents/:incidentId/review-lock",
        "incidents.update",
      ],
      [
        "DELETE /api/v1/admin/incidents/:incidentId/review-lock",
        "incidents.update",
      ],
      ["PATCH /api/v1/admin/posts/:postId/status", "posts.moderate"],
      ["GET /api/v1/admin/posts", "posts.moderate"],
      ["GET /api/v1/admin/posts/:postId", "posts.moderate"],
      ["PATCH /api/v1/admin/posts/:postId", "posts.moderate"],
      ["POST /api/v1/admin/posts/:postId/hide", "posts.moderate"],
      ["POST /api/v1/admin/posts/:postId/restore", "posts.moderate"],
      ["DELETE /api/v1/admin/posts/:postId", "posts.moderate"],
      [
        "PATCH /api/v1/admin/comments/:commentId/status",
        "comments.moderate",
      ],
      ["GET /api/v1/admin/comments", "comments.moderate"],
      ["GET /api/v1/admin/comments/:commentId", "comments.moderate"],
      ["PATCH /api/v1/admin/comments/:commentId", "comments.moderate"],
      [
        "POST /api/v1/admin/comments/:commentId/hide",
        "comments.moderate",
      ],
      [
        "POST /api/v1/admin/comments/:commentId/restore",
        "comments.moderate",
      ],
      ["DELETE /api/v1/admin/comments/:commentId", "comments.moderate"],
    ]);

    const administrativeRoutes = routes.filter(({ path }) =>
      path.startsWith("/api/v1/admin/"),
    );
    expect(administrativeRoutes).toHaveLength(expected.size);

    for (const route of administrativeRoutes) {
      expect(
        configuredPermission(route),
        `${routeKey(route)} debe declarar un permiso administrativo`,
      ).toBe(expected.get(routeKey(route)));
    }
  });
});
