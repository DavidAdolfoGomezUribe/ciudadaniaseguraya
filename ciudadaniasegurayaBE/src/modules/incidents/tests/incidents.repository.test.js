import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";

import { createIncidentsRepository } from "../repositories/incidents.repository.js";

const cityId = "507f1f77bcf86cd799439011";
const h3Index = "8966e42888fffff";

function fixture() {
  const toArray = vi.fn().mockResolvedValue([]);
  const limit = vi.fn(() => ({ toArray }));
  const sort = vi.fn(() => ({ limit }));
  const find = vi.fn(() => ({ sort }));
  const db = {
    collection: vi.fn((name) =>
      name === "incidents" ? { find } : {},
    ),
  };

  return {
    find,
    repository: createIncidentsRepository(db),
  };
}

describe("repositorio de incidentes publicos por H3", () => {
  it("filtra el detalle anual con los limites exactos del servicio", async () => {
    const from = new Date("2026-01-01T12:30:00.001Z");
    const to = new Date("2027-01-01T12:30:00.001Z");
    const { find, repository } = fixture();

    await repository.listPublicByH3({
      cityId,
      h3Index,
      resolution: 9,
      from,
      to,
      timezone: "America/Bogota",
      limit: 50,
    });

    expect(find).toHaveBeenCalledWith(
      {
        cityId: new ObjectId(cityId),
        "h3Cells.9": h3Index,
        status: {
          $in: ["community_confirmed", "admin_verified"],
        },
        deletedAt: null,
        occurredAt: {
          $gte: from,
          $lte: to,
        },
      },
      expect.any(Object),
    );
  });

  it("conserva el filtro mensual con la zona horaria solicitada", async () => {
    const { find, repository } = fixture();

    await repository.listPublicByH3({
      cityId,
      h3Index,
      resolution: 9,
      month: "2026-07",
      timezone: "America/Bogota",
      limit: 50,
    });

    const [filter] = find.mock.calls[0];
    expect(filter).toMatchObject({
      cityId: new ObjectId(cityId),
      "h3Cells.9": h3Index,
      status: {
        $in: ["community_confirmed", "admin_verified"],
      },
      deletedAt: null,
      $expr: {
        $eq: [
          {
            $dateToString: {
              date: "$occurredAt",
              format: "%Y-%m",
              timezone: "America/Bogota",
            },
          },
          "2026-07",
        ],
      },
    });
    expect(filter).not.toHaveProperty("occurredAt");
  });
});
