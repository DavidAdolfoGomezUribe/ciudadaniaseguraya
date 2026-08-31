import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";

import {
  PUBLIC_STATISTICS_STATUSES,
  buildStatisticsMatch,
  createStatisticsRepository,
} from "../repositories/statistics.repository.js";

const cityId = "507f1f77bcf86cd799439011";
const from = new Date("2026-01-01T00:00:00.000Z");
const to = new Date("2026-12-31T23:59:59.999Z");

function repositoryWithResult(result = []) {
  const toArray = vi.fn().mockResolvedValue(result);
  const aggregate = vi.fn(() => ({ toArray }));
  const collection = vi.fn(() => ({ aggregate }));
  const db = { collection };

  return {
    aggregate,
    repository: createStatisticsRepository(db),
    toArray,
  };
}

function query(overrides = {}) {
  return {
    cityId,
    from,
    to,
    timezone: "America/Bogota",
    groupBy: "month",
    ...overrides,
  };
}

describe("repositorio de estadisticas", () => {
  it("construye un filtro exclusivo para estados publicos validados", () => {
    const match = buildStatisticsMatch(
      query({
        h3Index: "8966e42888fffff",
        h3Resolution: 9,
        incidentType: "robo",
      }),
    );

    expect(match).toEqual({
      status: { $in: [...PUBLIC_STATISTICS_STATUSES] },
      deletedAt: null,
      occurredAt: { $gte: from, $lte: to },
      cityId: new ObjectId(cityId),
      incidentType: "robo",
      "h3Cells.9": "8966e42888fffff",
    });
    expect(match.status.$in).not.toContain("pending");
    expect(match.status.$in).not.toContain("rejected");
  });

  it.each(["overview", "timeseries", "hourly", "types"])(
    "%s inicia la agregacion con el mismo filtro publico",
    async (method) => {
      const { aggregate, repository } = repositoryWithResult();

      await repository[method](query());

      const [pipeline] = aggregate.mock.calls[0];
      expect(pipeline[0].$match).toMatchObject({
        status: { $in: [...PUBLIC_STATISTICS_STATUSES] },
        deletedAt: null,
        occurredAt: { $gte: from, $lte: to },
      });
    },
  );

  it("agrupa comparaciones por cada hexagono vecino", async () => {
    const indexes = ["8966e42888fffff", "8966e428887ffff"];
    const { aggregate, repository } = repositoryWithResult([]);

    await repository.byHexagons(
      query({
        h3Indexes: indexes,
        h3Resolution: 9,
      }),
    );

    const [pipeline] = aggregate.mock.calls[0];
    expect(pipeline[0].$match["h3Cells.9"]).toEqual({ $in: indexes });
    expect(pipeline[1].$group._id).toBe("$h3Cells.9");
  });

  it("agrupa la serie con formato y zona horaria solicitados", async () => {
    const { aggregate, repository } = repositoryWithResult([
      { key: "2026-07", incidentCount: 3 },
    ]);

    const result = await repository.timeseries(query());
    const [pipeline] = aggregate.mock.calls[0];

    expect(
      pipeline[1].$group._id.$dateToString,
    ).toEqual({
      date: "$occurredAt",
      format: "%Y-%m",
      timezone: "America/Bogota",
    });
    expect(result).toEqual([{ key: "2026-07", incidentCount: 3 }]);
  });

  it("devuelve ceros coherentes cuando el resumen no tiene filas", async () => {
    const { repository } = repositoryWithResult([]);

    await expect(repository.overview(query())).resolves.toEqual({
      incidentCount: 0,
      communityConfirmedCount: 0,
      adminVerifiedCount: 0,
      firstOccurredAt: null,
      lastOccurredAt: null,
      lastUpdatedAt: null,
    });
  });
});
