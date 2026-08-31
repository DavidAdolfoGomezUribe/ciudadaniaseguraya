import { ObjectId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createAuthService } from "../services/auth.service.js";

const now = new Date("2026-07-26T12:00:00.000Z");

function userDocument(overrides = {}) {
  return {
    _id: new ObjectId(),
    email: "persona@example.com",
    normalizedEmail: "persona@example.com",
    username: "persona",
    normalizedUsername: "persona",
    role: "user",
    status: "active",
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    lastLoginAt: null,
    ...overrides,
  };
}

function dependencies(identity = {}) {
  const usersRepository = {
    create: vi.fn(async () => ({ insertedId: new ObjectId() })),
    findByGoogleSubject: vi.fn(async () => null),
    findByNormalizedEmail: vi.fn(async () => null),
    findByNormalizedUsername: vi.fn(async () => null),
    findByLogin: vi.fn(async () => null),
    findById: vi.fn(async () => null),
    linkGoogleIdentity: vi.fn(async () => null),
    updateLastLogin: vi.fn(async () => ({ modifiedCount: 1 })),
  };
  const refreshTokenRepository = {
    create: vi.fn(async () => ({ insertedId: new ObjectId() })),
  };
  const googleIdentityProvider = {
    verifyCredential: vi.fn(async () => ({
      subject: "google-subject-1",
      email: "persona@example.com",
      name: "Persona",
      ...identity,
    })),
  };
  const service = createAuthService({
    usersRepository,
    refreshTokenRepository,
    googleIdentityProvider,
    config: {
      jwtRefreshSecret: "r".repeat(32),
      jwtRefreshExpiresIn: "7d",
    },
    signAccessToken: vi.fn(async () => "access-token"),
    clock: () => now,
  });

  return {
    service,
    usersRepository,
    refreshTokenRepository,
    googleIdentityProvider,
  };
}

describe("AuthService con Google", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("crea una cuenta Google verificada sin inventar una contraseña", async () => {
    const { service, usersRepository, refreshTokenRepository } = dependencies();

    const result = await service.google("google-credential");
    const created = usersRepository.create.mock.calls[0][0];

    expect(created).toMatchObject({
      email: "persona@example.com",
      normalizedEmail: "persona@example.com",
      googleSubject: "google-subject-1",
      emailVerified: true,
      role: "user",
      status: "active",
    });
    expect(created).not.toHaveProperty("passwordHash");
    expect(created.username).toMatch(/^persona_[a-f0-9]{12}$/);
    expect(result.user.authProviders).toEqual(["google"]);
    expect(result.session.accessToken).toBe("access-token");
    expect(refreshTokenRepository.create).toHaveBeenCalledOnce();
  });

  it("inicia sesion si la identidad ya esta vinculada", async () => {
    const { service, usersRepository } = dependencies();
    const linkedUser = userDocument({
      googleSubject: "google-subject-1",
    });
    usersRepository.findByGoogleSubject.mockResolvedValue(linkedUser);

    const result = await service.google("google-credential");

    expect(result.user.id).toBe(linkedUser._id.toHexString());
    expect(result.user.authProviders).toEqual(["google"]);
    expect(usersRepository.findByNormalizedEmail).not.toHaveBeenCalled();
    expect(usersRepository.updateLastLogin).toHaveBeenCalledWith(
      linkedUser._id,
      now,
    );
  });

  it("no vincula automaticamente una cuenta local con el mismo correo", async () => {
    const { service, usersRepository, refreshTokenRepository } = dependencies();
    usersRepository.findByNormalizedEmail.mockResolvedValue(
      userDocument({ passwordHash: "$argon2id$existing" }),
    );

    await expect(service.google("google-credential")).rejects.toMatchObject({
      code: "GOOGLE_ACCOUNT_LINK_REQUIRED",
      statusCode: 409,
    });
    expect(usersRepository.create).not.toHaveBeenCalled();
    expect(refreshTokenRepository.create).not.toHaveBeenCalled();
  });

  it("vincula solo una identidad con el mismo correo verificado", async () => {
    const { service, usersRepository } = dependencies();
    const localUser = userDocument({ passwordHash: "$argon2id$existing" });
    usersRepository.findById.mockResolvedValue(localUser);
    usersRepository.linkGoogleIdentity.mockResolvedValue({
      ...localUser,
      googleSubject: "google-subject-1",
    });

    const result = await service.linkGoogle(
      localUser._id,
      "google-credential",
    );

    expect(usersRepository.linkGoogleIdentity).toHaveBeenCalledWith(
      localUser._id,
      "google-subject-1",
      now,
    );
    expect(result.authProviders).toEqual(["password", "google"]);
  });

  it("rechaza vincular un correo de Google diferente", async () => {
    const { service, usersRepository } = dependencies({
      email: "otra@example.com",
    });
    const localUser = userDocument({ passwordHash: "$argon2id$existing" });
    usersRepository.findById.mockResolvedValue(localUser);

    await expect(
      service.linkGoogle(localUser._id, "google-credential"),
    ).rejects.toMatchObject({
      code: "GOOGLE_EMAIL_MISMATCH",
      statusCode: 409,
    });
    expect(usersRepository.linkGoogleIdentity).not.toHaveBeenCalled();
  });

  it("trata una cuenta solo Google como credenciales tradicionales invalidas", async () => {
    const { service, usersRepository } = dependencies();
    usersRepository.findByLogin.mockResolvedValue(
      userDocument({ googleSubject: "google-subject-1" }),
    );

    await expect(
      service.login({
        identifier: "persona@example.com",
        password: "Clave-Que-No-Existe-2026",
      }),
    ).rejects.toMatchObject({
      code: "INVALID_CREDENTIALS",
      statusCode: 401,
    });
  });
});
