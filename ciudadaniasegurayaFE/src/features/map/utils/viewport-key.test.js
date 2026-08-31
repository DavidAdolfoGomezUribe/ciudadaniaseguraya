import { describe, expect, it } from "vitest";

import { intersectsColombia, normalizeBounds, viewportKey } from "./viewport-key";

const bogotaViewport = {
  north: 4.8,
  south: 4.5,
  east: -73.9,
  west: -74.3,
};

describe("normalizacion y reutilizacion de viewport", () => {
  it("amplia, redondea y limita los bounds a Colombia", () => {
    expect(normalizeBounds(bogotaViewport)).toEqual({
      north: 4.836,
      south: 4.464,
      east: -73.852,
      west: -74.348,
    });

    expect(
      normalizeBounds({
        north: 20,
        south: -10,
        east: -60,
        west: -90,
      }),
    ).toEqual({
      north: 13.7,
      south: -4.6,
      east: -66.5,
      west: -79.2,
    });
  });

  it("reutiliza la clave de red ante movimientos inferiores a dos metros", () => {
    const tinyMovement = {
      north: bogotaViewport.north + 0.00001,
      south: bogotaViewport.south + 0.00001,
      east: bogotaViewport.east + 0.00001,
      west: bogotaViewport.west + 0.00001,
    };

    expect(viewportKey(tinyMovement)).toBe(viewportKey(bogotaViewport));
  });

  it("cambia la clave cuando cambia materialmente el area", () => {
    expect(
      viewportKey({ ...bogotaViewport, east: bogotaViewport.east + 0.2 }),
    ).not.toBe(viewportKey(bogotaViewport));
  });

  it("conserva bounds no degenerados en el zoom máximo", () => {
    const result = normalizeBounds(
      {
        north: 4.71124,
        south: 4.71076,
        east: -74.07176,
        west: -74.07244,
      },
      0,
    );

    expect(result.north).toBeGreaterThan(result.south);
    expect(result.east).toBeGreaterThan(result.west);
  });

  it.each([
    [bogotaViewport, true],
    [{ north: 20, south: 15, east: -70, west: -75 }, false],
    [{ north: 5, south: 2, east: -80, west: -85 }, false],
    [{ north: 13.7, south: 13.7, east: -66.5, west: -66.5 }, true],
  ])("detecta interseccion geografica %#", (bounds, expected) => {
    expect(intersectsColombia(bounds)).toBe(expected);
  });
});
