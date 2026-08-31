import { describe, expect, it } from "vitest";

import {
  isAdministrativeRealtimeEvent,
  isPublicRealtimeEvent,
} from "../event-scope.js";

function event(type, data = {}) {
  return { type, data };
}

describe("alcance de eventos en tiempo real", () => {
  it("nunca entrega eventos administrativos al stream publico", () => {
    expect(
      isPublicRealtimeEvent(event("admin.user.suspended")),
    ).toBe(false);
    expect(
      isPublicRealtimeEvent(event("admin.incident.pending.created")),
    ).toBe(false);
    expect(
      isAdministrativeRealtimeEvent(event("admin.user.suspended")),
    ).toBe(true);
    expect(
      isAdministrativeRealtimeEvent(event("incident.admin_verified")),
    ).toBe(false);
  });

  it("no revela cambios de incidentes que no son publicos", () => {
    expect(
      isPublicRealtimeEvent(
        event("incident.created", { status: "pending" }),
      ),
    ).toBe(false);
    expect(
      isPublicRealtimeEvent(
        event("incident.updated", { status: "pending" }),
      ),
    ).toBe(false);
    expect(isPublicRealtimeEvent(event("incident.rejected"))).toBe(false);
    expect(
      isPublicRealtimeEvent(
        event("incident.updated", { status: "admin_verified" }),
      ),
    ).toBe(true);
  });

  it("mantiene eventos ciudadanos publicos", () => {
    expect(isPublicRealtimeEvent(event("heatmap.updated"))).toBe(true);
    expect(isPublicRealtimeEvent(event("post.created"))).toBe(true);
    expect(
      isPublicRealtimeEvent(event("incident.community_confirmed")),
    ).toBe(true);
  });
});
