import { describe, expect, it, vi } from "vitest";

import { createRealtimeController } from "../realtime.controller.js";

function event(id, type) {
  return {
    id,
    type,
    occurredAt: "2026-07-29T16:00:00.000Z",
    data: {},
  };
}

function harness(acceptsEvent, options = {}) {
  let listener;
  const eventBus = {
    eventsAfter: vi
      .fn()
      .mockReturnValue([
        event("public-1", "incident.updated"),
        event("admin-1", "admin.incident.locked"),
      ]),
    subscribe: vi.fn((next) => {
      listener = next;
      return vi.fn();
    }),
  };
  const reply = {
    sse: {
      keepAlive: vi.fn(),
      onClose: vi.fn(),
      send: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
      lastEventId: undefined,
    },
  };
  const controller = createRealtimeController({
    eventBus,
    connectionRegistry: { acquire: vi.fn(() => vi.fn()) },
    acceptsEvent,
    createId: () => "connected-1",
    clock: () => new Date("2026-07-29T16:00:00.000Z"),
    ...options,
  });
  return { controller, eventBus, reply, getListener: () => listener };
}

describe("realtime controller event scopes", () => {
  it("filtra el historial y eventos nuevos con el mismo predicado", async () => {
    const { controller, reply, getListener } = harness(
      (item) => !item.type.startsWith("admin."),
    );

    await controller.stream(
      { query: { clientId: "public-client", lastEventId: "previous" } },
      reply,
    );

    expect(reply.sse.send).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "public-1",
        event: "incident.updated",
      }),
    );
    expect(reply.sse.send).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: "admin-1" }),
    );

    getListener()(event("admin-2", "admin.user.suspended"));
    getListener()(event("public-2", "incident.updated"));
    await vi.waitFor(() => {
      expect(reply.sse.send).toHaveBeenCalledWith(
        expect.objectContaining({ id: "public-2" }),
      );
    });
    expect(reply.sse.send).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: "admin-2" }),
    );
  });

  it("cierra el flujo administrativo si la sesion fue revocada", async () => {
    const revalidateConnection = vi.fn().mockResolvedValue(false);
    const { controller, reply, getListener } = harness(
      (item) => item.type.startsWith("admin."),
      { revalidateConnection },
    );

    await controller.stream(
      { query: { clientId: "admin-client" } },
      reply,
    );
    getListener()(event("admin-2", "admin.user.suspended"));

    await vi.waitFor(() => {
      expect(reply.sse.close).toHaveBeenCalledOnce();
    });
    expect(revalidateConnection).toHaveBeenCalledOnce();
    expect(reply.sse.send).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: "admin-2" }),
    );
  });

  it("revalida tambien los eventos administrativos recuperados del historial", async () => {
    const revalidateConnection = vi.fn().mockResolvedValue(false);
    const { controller, reply } = harness(
      (item) => item.type.startsWith("admin."),
      { revalidateConnection },
    );

    await controller.stream(
      {
        query: {
          clientId: "admin-history-client",
          lastEventId: "previous",
        },
      },
      reply,
    );

    expect(revalidateConnection).toHaveBeenCalledOnce();
    expect(reply.sse.close).toHaveBeenCalledOnce();
    expect(reply.sse.send).not.toHaveBeenCalledWith(
      expect.objectContaining({ id: "admin-1" }),
    );
  });

  it("no envia un evento si el token expira durante la revalidacion", async () => {
    vi.useFakeTimers();
    try {
      const expiresAt = Date.now() + 100;
      let finishValidation;
      const revalidateConnection = vi.fn(
        () =>
          new Promise((resolve) => {
            finishValidation = resolve;
          }),
      );
      const { controller, reply, getListener } = harness(
        (item) => item.type.startsWith("admin."),
        {
          revalidateConnection,
          connectionExpiresAt: () => expiresAt,
          validationIntervalMs: 0,
        },
      );

      await controller.stream(
        { query: { clientId: "admin-expiring-client" } },
        reply,
      );
      getListener()(event("admin-after-expiration", "admin.user.updated"));
      await vi.advanceTimersByTimeAsync(0);
      expect(revalidateConnection).toHaveBeenCalledOnce();

      await vi.advanceTimersByTimeAsync(101);
      expect(reply.sse.close).toHaveBeenCalledOnce();

      finishValidation(true);
      await vi.advanceTimersByTimeAsync(0);

      expect(reply.sse.send).not.toHaveBeenCalledWith(
        expect.objectContaining({ id: "admin-after-expiration" }),
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
