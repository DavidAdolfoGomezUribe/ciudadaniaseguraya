import { describe, expect, it } from "vitest";

import { reportIncidentBodySchema } from "../../incidents/validators/incident.schemas.js";
import { BOGOTA_BOUNDARY } from "../constants/bogota-geography.js";
import { heatmapStyle } from "../constants/heatmap.js";
import {
  h3Boundary,
  h3Cell,
  h3CellsForResolutions,
  toGeoJsonPoint,
} from "../h3/h3.js";
import { pointBelongsToBoundary } from "../providers/city-boundary.js";

describe("utilidades geoespaciales", () => {
  it("mantiene el orden GeoJSON longitud, latitud", () => {
    expect(
      toGeoJsonPoint({ latitude: 4.711, longitude: -74.0721 }),
    ).toEqual({
      type: "Point",
      coordinates: [-74.0721, 4.711],
    });
  });

  it("calcula H3 de forma determinista para Bogota", () => {
    expect(h3Cell(4.711, -74.0721, 9)).toBe("8966e42888fffff");
    expect(
      h3CellsForResolutions(4.711, -74.0721, [4, 5, 6, 7, 8, 9]),
    ).toEqual({
      4: expect.any(String),
      5: expect.any(String),
      6: expect.any(String),
      7: expect.any(String),
      8: expect.any(String),
      9: "8966e42888fffff",
    });
  });

  it("genera un poligono GeoJSON cerrado", () => {
    const ring = h3Boundary("8966e42888fffff").coordinates[0];
    expect(ring[0]).toEqual(ring.at(-1));
  });

  it.each([
    ["latitud", { latitude: 91, longitude: -74.0721 }],
    ["longitud", { latitude: 4.711, longitude: -181 }],
  ])("rechaza %s invalida", (_name, coordinates) => {
    const parsed = reportIncidentBodySchema.safeParse({
      cityId: "507f1f77bcf86cd799439011",
      incidentType: "robo",
      title: "Incidente de prueba",
      description: "Descripcion suficientemente extensa para validar.",
      occurredAt: "2026-07-26T18:30:00.000Z",
      ...coordinates,
    });
    expect(parsed.success).toBe(false);
  });

  it("aplica todos los niveles de la escala del mapa", () => {
    expect([0, 1, 3, 6, 10, 20].map(heatmapStyle)).toMatchObject([
      { level: 0, color: "#2563EB" },
      { level: 1, color: "#22C55E" },
      { level: 2, color: "#EAB308" },
      { level: 3, color: "#F97316" },
      { level: 4, color: "#EF4444" },
      { level: 5, color: "#111827" },
    ]);
  });

  it("respeta poligonos de ciudad y sus huecos", () => {
    const boundary = {
      type: "Polygon",
      coordinates: [
        [
          [-75, 4],
          [-73, 4],
          [-73, 6],
          [-75, 6],
          [-75, 4],
        ],
        [
          [-74.2, 4.8],
          [-73.8, 4.8],
          [-73.8, 5.2],
          [-74.2, 5.2],
          [-74.2, 4.8],
        ],
      ],
    };

    expect(
      pointBelongsToBoundary(toGeoJsonPoint({
        latitude: 4.5,
        longitude: -74,
      }), boundary),
    ).toBe(true);
    expect(
      pointBelongsToBoundary(toGeoJsonPoint({
        latitude: 5,
        longitude: -74,
      }), boundary),
    ).toBe(false);
  });

  it("aplica el limite inicial de Bogota y rechaza limites ausentes", () => {
    expect(
      pointBelongsToBoundary(
        toGeoJsonPoint({
          latitude: 4.711,
          longitude: -74.0721,
        }),
        BOGOTA_BOUNDARY,
      ),
    ).toBe(true);
    expect(
      pointBelongsToBoundary(
        toGeoJsonPoint({
          latitude: 6.2442,
          longitude: -75.5812,
        }),
        BOGOTA_BOUNDARY,
      ),
    ).toBe(false);
    expect(
      pointBelongsToBoundary(
        toGeoJsonPoint({
          latitude: 4.711,
          longitude: -74.0721,
        }),
        null,
      ),
    ).toBe(false);
  });
});
