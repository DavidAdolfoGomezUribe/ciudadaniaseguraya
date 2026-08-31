import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";

import { createHeatmapRepository } from "../repositories/heatmap.repository.js";

const cityId = "507f1f77bcf86cd799439011";
const from = new Date("2026-01-01T12:00:00.000Z");
const to = new Date("2027-01-01T12:00:00.000Z");

function fixture(annualRows = []) {
  const aggregateToArray = vi.fn().mockResolvedValue(annualRows);
  const aggregate = vi.fn(() => ({ toArray: aggregateToArray }));
  const monthlyToArray = vi.fn().mockResolvedValue([]);
  const limit = vi.fn(() => ({ toArray: monthlyToArray }));
  const find = vi.fn(() => ({ limit }));
  const findOne = vi.fn().mockResolvedValue(null);
  const monthly = {
    bulkWrite: vi.fn(),
    find,
    findOne,
  };
  const incidents = { aggregate };
  const db = {
    collection: vi.fn((name) =>
      name === "incidents" ? incidents : monthly,
    ),
  };

  return {
    aggregate,
    aggregateToArray,
    find,
    findOne,
    repository: createHeatmapRepository(db),
  };
}

function annualInput(overrides = {}) {
  return {
    cityId,
    resolution: 9,
    north: 4.8,
    south: 4.6,
    east: -73.9,
    west: -74.2,
    from,
    to,
    ...overrides,
  };
}

describe("repositorio del mapa H3", () => {
  it("agrega la ventana anual desde incidentes publicos y dentro del viewport", async () => {
    const { aggregate, repository } = fixture([
      {
        h3Index: "8966e42888fffff",
        h3Resolution: 9,
        month: null,
        incidentCount: 1,
        incidentTypes: { robo: 1 },
        lastUpdatedAt: to,
      },
    ]);

    const result = await repository.queryViewport(
      annualInput({ incidentType: "robo" }),
    );
    const [pipeline] = aggregate.mock.calls[0];
    const match = pipeline[0].$match;

    expect(match).toMatchObject({
      cityId: new ObjectId(cityId),
      status: {
        $in: ["community_confirmed", "admin_verified"],
      },
      deletedAt: null,
      occurredAt: { $gte: from, $lte: to },
      incidentType: "robo",
      "h3Cells.9": { $type: "string" },
      location: {
        $geoWithin: {
          $geometry: {
            type: "Polygon",
          },
        },
      },
    });
    expect(pipeline[1].$group._id).toEqual({
      h3Index: "$h3Cells.9",
      incidentType: "$incidentType",
    });
    expect(pipeline[2].$group._id).toBe("$_id.h3Index");
    expect(pipeline.at(-1)).toEqual({ $limit: 10_000 });
    expect(result[0].incidentCount).toBe(1);
  });

  it("agrega un hexagono anual exacto sin depender del preagregado mensual", async () => {
    const h3Index = "8966e42888fffff";
    const { aggregate, repository } = fixture([
      {
        h3Index,
        h3Resolution: 9,
        month: null,
        incidentCount: 2,
        incidentTypes: { hurto: 2 },
        lastUpdatedAt: to,
      },
    ]);

    const result = await repository.findCell({
      cityId,
      resolution: 9,
      h3Index,
      from,
      to,
    });
    const [pipeline] = aggregate.mock.calls[0];

    expect(pipeline[0].$match).toMatchObject({
      cityId: new ObjectId(cityId),
      status: {
        $in: ["community_confirmed", "admin_verified"],
      },
      deletedAt: null,
      occurredAt: { $gte: from, $lte: to },
      "h3Cells.9": h3Index,
    });
    expect(pipeline[0].$match).not.toHaveProperty("location");
    expect(result.incidentCount).toBe(2);
  });

  it("conserva la consulta al preagregado cuando se envia month", async () => {
    const { aggregate, find, repository } = fixture();

    await repository.queryViewport(
      annualInput({
        month: "2026-07",
        from: undefined,
        to: undefined,
      }),
    );

    expect(aggregate).not.toHaveBeenCalled();
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        cityId: new ObjectId(cityId),
        month: "2026-07",
        h3Resolution: 9,
      }),
      expect.any(Object),
    );
  });
});
