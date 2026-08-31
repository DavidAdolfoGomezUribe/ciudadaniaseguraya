import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";

import { createAuditRepository } from "../../../../shared/audit/audit.repository.js";
import { buildIndexDefinitions } from "../../../../shared/database/schema.js";
import { createAdminManagementRepository } from "../repositories/admin-management.repository.js";

function databaseHarness() {
  const collections = new Map();

  return {
    collections,
    db: {
      collection(name) {
        if (!collections.has(name)) {
          collections.set(name, {
            updateMany: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
          });
        }
        return collections.get(name);
      },
    },
  };
}

describe("contratos de persistencia administrativa", () => {
  it("busca administradores por username, displayName y correo sin interpretar regex", async () => {
    const { db, collections } = databaseHarness();
    const toArray = vi.fn().mockResolvedValue([]);
    const limit = vi.fn(() => ({ toArray }));
    const skip = vi.fn(() => ({ limit }));
    const sort = vi.fn(() => ({ skip }));
    const find = vi.fn(() => ({ sort }));
    const countDocuments = vi.fn().mockResolvedValue(0);
    collections.set("users", { find, countDocuments });
    const repository = createAdminManagementRepository(db);

    await repository.listAdministrators({
      page: 1,
      pageSize: 25,
      search: "admin+ops@example.com",
      includeEmailSearch: true,
    });

    const filter = find.mock.calls[0][0];
    expect(filter.role).toEqual({ $in: ["admin", "superadmin"] });
    expect(filter.$or.map((condition) => Object.keys(condition)[0])).toEqual([
      "username",
      "displayName",
      "email",
    ]);
    for (const condition of filter.$or) {
      const expression = Object.values(condition)[0];
      expect(expression).toBeInstanceOf(RegExp);
      expect(expression.source).toBe("admin\\+ops@example\\.com");
      expect(expression.flags).toContain("i");
    }
    expect(countDocuments).toHaveBeenCalledWith(filter);
  });

  it("no permite inferir correos administrativos cuando el actor no puede verlos", async () => {
    const { db, collections } = databaseHarness();
    const toArray = vi.fn().mockResolvedValue([]);
    const limit = vi.fn(() => ({ toArray }));
    const skip = vi.fn(() => ({ limit }));
    const sort = vi.fn(() => ({ skip }));
    const find = vi.fn(() => ({ sort }));
    collections.set("users", {
      find,
      countDocuments: vi.fn().mockResolvedValue(0),
    });
    const repository = createAdminManagementRepository(db);

    await repository.listAdministrators({
      page: 1,
      pageSize: 25,
      search: "private@example.com",
      includeEmailSearch: false,
    });

    const filter = find.mock.calls[0][0];
    expect(filter.$or.map((condition) => Object.keys(condition)[0])).toEqual([
      "username",
      "displayName",
    ]);
  });

  it("revoca sesiones ciudadanas y administrativas en colecciones separadas", async () => {
    const { db, collections } = databaseHarness();
    const repository = createAdminManagementRepository(db);
    const userId = new ObjectId();
    const now = new Date("2026-07-29T16:00:00.000Z");

    await repository.revokeSessions(userId, now);
    await repository.revokeSessions(userId, now, "admin");

    expect(collections.get("refresh_tokens").updateMany).toHaveBeenCalledWith(
      { userId, revokedAt: null },
      {
        $set: {
          revokedAt: now,
          replacedByTokenHash: null,
        },
      },
    );
    expect(
      collections.get("admin_refresh_tokens").updateMany,
    ).toHaveBeenCalledWith(
      { userId, revokedAt: null },
      {
        $set: {
          revokedAt: now,
          replacedByTokenHash: null,
        },
      },
    );
  });

  it("mantiene un unico request pendiente por candidato con indices de consulta", () => {
    const definitions = buildIndexDefinitions({
      h3SupportedResolutions: [9],
    }).admin_role_requests;

    expect(definitions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: { candidateUserId: 1, status: 1 },
          unique: true,
          partialFilterExpression: { status: "pending" },
        }),
        expect.objectContaining({ key: { createdAt: -1 } }),
        expect.objectContaining({ key: { status: 1, createdAt: 1 } }),
      ]),
    );
  });

  it("persiste actorUserId sin romper la compatibilidad con actorId", async () => {
    const insertOne = vi.fn().mockResolvedValue({ insertedId: new ObjectId() });
    const repository = createAuditRepository({
      collection: vi.fn(() => ({ insertOne })),
    });
    const actorUserId = new ObjectId();
    const createdAt = new Date("2026-07-29T16:00:00.000Z");

    await repository.record({
      actorUserId,
      actorRole: "admin",
      action: "user.updated",
      resourceType: "user",
      resourceId: new ObjectId(),
      createdAt,
    });

    expect(insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: actorUserId,
        actorUserId,
        actorRole: "admin",
        createdAt,
      }),
    );
  });
});
