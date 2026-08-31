import { ObjectId } from "mongodb";
import { beforeAll, describe, expect, it, vi } from "vitest";

import { hashPassword } from "../../../../shared/security/password.js";
import { hashRefreshToken } from "../../../../shared/security/tokens.js";
import { createAdminAuthService } from "../services/admin-auth.service.js";

const now = new Date("2026-07-29T12:00:00.000Z");
const config = {
  jwtRefreshSecret: "r".repeat(32),
  jwtRefreshExpiresIn: "7d",
};
let passwordHash;

beforeAll(async () => {
  passwordHash = await hashPassword("Clave-Administrativa-2026");
});

function userDocument(role = "admin") {
  return {
    _id: new ObjectId(),
    email: "admin@example.test",
    normalizedEmail: "admin@example.test",
    username: "admin_test",
    normalizedUsername: "admin_test",
    displayName: "Admin Test",
    passwordHash,
    role,
    status: "active",
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    lastLoginAt: null,
  };
}

function dependencies(user = userDocument()) {
  const usersRepository = {
    findByLogin: vi.fn(async () => user),
    findById: vi.fn(async () => user),
    updateLastLogin: vi.fn(async () => ({ modifiedCount: 1 })),
  };
  const adminSessionRepository = {
    create: vi.fn(async () => ({ insertedId: new ObjectId() })),
    findByTokenHash: vi.fn(async () => null),
    findUsable: vi.fn(async () => null),
    rotate: vi.fn(async () => ({ modifiedCount: 1 })),
    revokeToken: vi.fn(async () => ({ modifiedCount: 1 })),
    revokeSession: vi.fn(async () => ({ modifiedCount: 1 })),
    revokeAllForUser: vi.fn(async () => ({ modifiedCount: 1 })),
  };
  const auditRepository = {
    record: vi.fn(async () => ({ insertedId: new ObjectId() })),
  };
  const signAccessToken = vi.fn(async () => "admin-access-token");
  const service = createAdminAuthService({
    usersRepository,
    adminSessionRepository,
    auditRepository,
    config,
    signAccessToken,
    clock: () => now,
    createSessionId: () => "session-1",
  });

  return {
    service,
    usersRepository,
    adminSessionRepository,
    auditRepository,
    signAccessToken,
    user,
  };
}

describe("AdminAuthService", () => {
  it("crea una sesion admin aislada y devuelve permisos efectivos", async () => {
    const {
      service,
      adminSessionRepository,
      auditRepository,
      signAccessToken,
      user,
    } = dependencies();

    const result = await service.login(
      {
        identifier: user.username,
        password: "Clave-Administrativa-2026",
      },
      {
        requestId: "request-1",
        ipAddress: "127.0.0.1",
        userAgent: "vitest",
      },
    );

    expect(result.user).toMatchObject({
      id: user._id.toHexString(),
      role: "admin",
      displayName: "Admin Test",
    });
    expect(result.user.permissions).toContain("admin.dashboard.read");
    expect(result.user.permissions).not.toContain("admins.promote");
    expect(result.session.accessToken).toBe("admin-access-token");
    expect(adminSessionRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: user._id,
        sessionId: "session-1",
        revokedAt: null,
      }),
    );
    expect(
      adminSessionRepository.create.mock.calls[0][0],
    ).not.toHaveProperty("refreshToken");
    expect(signAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "admin",
        sid: "session-1",
        role: "admin",
      }),
    );
    expect(auditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin.login.success",
        actorRole: "admin",
        requestId: "request-1",
      }),
    );
  });

  it("rechaza una cuenta user aunque la contraseña sea correcta", async () => {
    const { service, auditRepository } = dependencies(userDocument("user"));

    await expect(
      service.login({
        identifier: "admin_test",
        password: "Clave-Administrativa-2026",
      }),
    ).rejects.toMatchObject({
      code: "ADMIN_ACCESS_DENIED",
      statusCode: 403,
    });
    expect(auditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin.login.failed",
        actorRole: "user",
      }),
    );
  });

  it("rota el refresh del vault administrativo conservando la sesion", async () => {
    const { service, adminSessionRepository, user } = dependencies();
    const rawToken = "refresh-administrativo";
    const tokenHash = hashRefreshToken(rawToken, config.jwtRefreshSecret);
    const storedToken = {
      userId: user._id,
      sessionId: "session-1",
      tokenHash,
      expiresAt: new Date("2026-08-05T12:00:00.000Z"),
      createdAt: now,
      revokedAt: null,
      ipAddress: "127.0.0.1",
      userAgent: "vitest",
    };
    adminSessionRepository.findByTokenHash.mockResolvedValue(storedToken);
    adminSessionRepository.findUsable.mockResolvedValue(storedToken);

    const result = await service.refresh(rawToken);

    expect(result.session.sessionId).toBe("session-1");
    expect(adminSessionRepository.rotate).toHaveBeenCalledWith(
      tokenHash,
      expect.any(String),
      now,
    );
    expect(result.user.role).toBe("admin");
  });

  it("revoca toda la familia cuando se reutiliza un refresh rotado", async () => {
    const { service, adminSessionRepository, user } = dependencies();
    adminSessionRepository.findByTokenHash.mockResolvedValue({
      userId: user._id,
      sessionId: "session-comprometida",
      revokedAt: now,
    });

    await expect(service.refresh("refresh-reutilizado")).rejects.toMatchObject({
      code: "ADMIN_INVALID_CREDENTIALS",
      statusCode: 401,
    });
    expect(adminSessionRepository.revokeSession).toHaveBeenCalledWith(
      "session-comprometida",
      now,
    );
  });
});
