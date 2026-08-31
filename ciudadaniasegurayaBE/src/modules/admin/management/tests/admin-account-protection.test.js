import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";

import { createUsersService } from "../../../users/services/users.service.js";

function serviceFor(role) {
  const userId = new ObjectId();
  const usersRepository = {
    findById: vi.fn().mockResolvedValue({
      _id: userId,
      role,
      status: "active",
    }),
    updateProfile: vi.fn(),
    anonymize: vi.fn(),
  };
  const service = createUsersService({
    usersRepository,
    refreshTokenRepository: {
      revokeAllForUser: vi.fn(),
    },
    auditRepository: {},
    accountContentRepository: {
      markAuthorDeleted: vi.fn(),
    },
  });

  return { service, userId, usersRepository };
}

describe("proteccion de cuentas administrativas fuera del panel", () => {
  it.each(["admin", "superadmin"])(
    "impide que una cuenta %s edite o elimine su perfil desde rutas ciudadanas",
    async (role) => {
      const { service, userId, usersRepository } = serviceFor(role);

      await expect(
        service.updateOwn(userId, { displayName: "Cambio no permitido" }),
      ).rejects.toMatchObject({ code: "FORBIDDEN", statusCode: 403 });
      await expect(service.deleteOwn(userId)).rejects.toMatchObject({
        code: "FORBIDDEN",
        statusCode: 403,
      });

      expect(usersRepository.updateProfile).not.toHaveBeenCalled();
      expect(usersRepository.anonymize).not.toHaveBeenCalled();
    },
  );
});
