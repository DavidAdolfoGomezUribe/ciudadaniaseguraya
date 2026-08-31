import { describe, expect, it, vi } from "vitest";

import { createConnectionRegistry } from "../connection-registry.js";
import { createEventBus } from "../event-bus.js";
import { createRealtimeController } from "../realtime.controller.js";

describe("bus de eventos en memoria", () => {
  it("publica, reproduce y deja de notificar al desuscribir", () => {
    const listener = vi.fn();
    let sequence = 0;
    const bus = createEventBus({
      createId: () => `event-${++sequence}`,
      clock: () => new Date("2026-07-26T19:00:00.000Z"),
    });
    const unsubscribe = bus.subscribe(listener);
    const first = bus.publish("incident.created", { incidentId: "one" });
    const second = bus.publish("heatmap.updated", { h3Index: "cell" });

    expect(listener).toHaveBeenCalledTimes(2);
    expect(first).toEqual({
      id: "event-1",
      type: "incident.created",
      occurredAt: "2026-07-26T19:00:00.000Z",
      data: { incidentId: "one" },
    });
    expect(bus.eventsAfter(first.id)).toEqual([second]);

    unsubscribe();
    bus.publish("post.created", {});
    expect(listener).toHaveBeenCalledTimes(2);
    expect(bus.listenerCount()).toBe(0);
  });

  it("limita conexiones por cliente y libera de forma idempotente", () => {
    const registry = createConnectionRegistry({
      maxConnections: 3,
      maxConnectionsPerClient: 1,
    });
    const release = registry.acquire("client-one");

    expect(() => registry.acquire("client-one")).toThrow(
      "limite de conexiones",
    );
    expect(registry.total()).toBe(1);
    release();
    release();
    expect(registry.total()).toBe(0);
    expect(registry.countForClient("client-one")).toBe(0);
  });

  it("reproduce desde query y mantiene preferencia por Last-Event-ID", async () => {
    let sequence = 0;
    const bus = createEventBus({
      createId: () => `event-${++sequence}`,
      clock: () => new Date("2026-07-26T19:00:00.000Z"),
    });
    const first = bus.publish("test.first");
    const second = bus.publish("test.second");
    const callbacks = [];
    const send = vi.fn().mockResolvedValue(undefined);
    const reply = {
      sse: {
        lastEventId: second.id,
        keepAlive: vi.fn(),
        onClose: (callback) => callbacks.push(callback),
        send,
        close: vi.fn(),
      },
    };
    const controller = createRealtimeController({
      eventBus: bus,
      connectionRegistry: createConnectionRegistry(),
      createId: () => "connected-id",
      clock: () => new Date("2026-07-26T19:01:00.000Z"),
    });

    await controller.stream(
      {
        query: {
          clientId: "test-client",
          lastEventId: first.id,
        },
      },
      reply,
    );

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({
      id: "connected-id",
      event: "system.connected",
    });
    callbacks[0]();

    reply.sse.lastEventId = null;
    send.mockClear();
    await controller.stream(
      {
        query: {
          clientId: "test-client",
          lastEventId: first.id,
        },
      },
      reply,
    );
    expect(send.mock.calls[0][0]).toMatchObject({
      id: second.id,
      event: "test.second",
    });
    callbacks.at(-1)();
  });
});
