import { cellToParent, latLngToCell } from "h3-js";
import { describe, expect, it } from "vitest";

import { eventCellAtResolution, eventIsVisible } from "./event-visibility";

const cell9 = latLngToCell(4.711, -74.0721, 9);
const cell7 = cellToParent(cell9, 7);

function scope(overrides = {}) {
  return {
    cityId: "bogota-id",
    period: "rolling-year",
    incidentType: null,
    resolution: 7,
    visibleH3Indexes: new Set([cell7]),
    ...overrides,
  };
}

function event(overrides = {}) {
  return {
    type: "heatmap.updated",
    data: {
      cityId: "bogota-id",
      period: "rolling-year",
      incidentType: "robo",
      h3Index: cell9,
      ...overrides,
    },
  };
}

describe("visibilidad de eventos H3", () => {
  it("convierte una celda detallada a la resolucion visible", () => {
    expect(eventCellAtResolution(cell9, 7)).toBe(cell7);
    expect(eventCellAtResolution(cell7, 7)).toBe(cell7);
  });

  it("rechaza indices invalidos", () => {
    expect(eventCellAtResolution("invalid-h3", 7)).toBeNull();
  });

  it("acepta un evento dentro del alcance activo", () => {
    expect(eventIsVisible(event(), scope())).toBe(true);
  });

  it("mantiene compatibles los eventos mensuales antiguos dentro del alcance anual", () => {
    expect(
      eventIsVisible(event({ period: undefined, month: "2026-06" }), scope()),
    ).toBe(true);
  });

  it.each([
    [event({ cityId: "medellin-id" }), scope()],
    [event({ period: "calendar-month" }), scope()],
    [event({ incidentType: "hurto" }), scope({ incidentType: "robo" })],
    [event({ h3Index: latLngToCell(6.25, -75.56, 9) }), scope()],
    [{ type: "heatmap.updated" }, scope()],
  ])("rechaza un evento fuera del alcance %#", (receivedEvent, activeScope) => {
    expect(eventIsVisible(receivedEvent, activeScope)).toBe(false);
  });
});
