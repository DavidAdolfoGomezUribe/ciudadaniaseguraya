import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";

import { createUsersService } from "../services/users.service.js";

function harness(role, adminMetadata) {
  const usersRepository = {
    findById: vi.fn().mockResolvedValue({
      _id: new ObjectId(),
      role,
      status: "active",
      adminMetadata,
    }),
    updateProfile: vi.fn(),
    anonymize: vi.fn(),
  };
  const service = createUsersService({
    usersRepository,
    refreshTokenRepository: {
      revokeAllForUser: vi.fn(),
    },
    auditRepository: {
      record: vi.fn(),
      list: vi.fn(),
      count: vi.fn(),
    },
    accountContentRepository: {
      markAuthorDeleted: vi.fn(),
    },
  });
  return { service, usersRepository };
}

describe("proteccion de cuentas administrativas en rutas ciudadanas", () => {
  it("impide editar una cuenta admin mediante users/me", async () => {
    const { service, usersRepository } = harness("admin");

    await expect(
      service.updateOwn(new ObjectId(), {
        username: "cambio_indebido",
      }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
    expect(usersRepository.updateProfile).not.toHaveBeenCalled();
  });

  it("impide autoeliminar al superadmin bootstrap mediante users/me", async () => {
    const { service, usersRepository } = harness("superadmin", {
      isBootstrapSuperadmin: true,
    });

    await expect(service.deleteOwn(new ObjectId())).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
    expect(usersRepository.anonymize).not.toHaveBeenCalled();
  });
});
