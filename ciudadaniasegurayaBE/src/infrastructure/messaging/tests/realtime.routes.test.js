import { describe, expect, it, vi } from "vitest";

import { registerRealtimeRoutes } from "../realtime.routes.js";

describe("seguridad de rutas SSE", () => {
  it("mantiene el stream publico abierto y protege el administrativo", async () => {
    const routes = [];
    const app = {
      get(path, options, handler) {
        routes.push({ path, options, handler });
      },
    };
    const authenticateAdmin = vi.fn();
    const publicController = { stream: vi.fn() };
    const adminController = { stream: vi.fn() };

    await registerRealtimeRoutes(app, {
      controller: publicController,
      adminController,
      authenticateAdmin,
    });

    expect(routes).toEqual([
      expect.objectContaining({
        path: "/api/v1/events/stream",
        options: expect.not.objectContaining({
          preHandler: expect.anything(),
        }),
        handler: publicController.stream,
      }),
      expect.objectContaining({
        path: "/api/v1/admin/events/stream",
        options: expect.objectContaining({
          preHandler: authenticateAdmin,
        }),
        handler: adminController.stream,
      }),
    ]);
  });
});
