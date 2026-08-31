import { createHash } from "node:crypto";

import { AppError, conflict } from "../../../shared/errors/app-error.js";
import {
  hashPassword,
  verifyPassword,
} from "../../../shared/security/password.js";
import {
  createRefreshToken,
  durationToMilliseconds,
  hashRefreshToken,
} from "../../../shared/security/tokens.js";
import {
  normalizeEmail,
  normalizeUsername,
} from "../../../shared/utils/normalization.js";
import { toOwnUserDto } from "../../users/dto/user.dto.js";

function unauthenticated() {
  return new AppError({
    code: "INVALID_CREDENTIALS",
    message: "Las credenciales no son validas",
    statusCode: 401,
  });
}

function assertActiveUser(user) {
  if (!user || user.status === "deleted") {
    throw unauthenticated();
  }

  if (user.status === "suspended") {
    throw new AppError({
      code: "ACCOUNT_SUSPENDED",
      message: "La cuenta esta suspendida",
      statusCode: 403,
    });
  }
}

function googleUsernameCandidates({ email, subject }) {
  const localPart = email
    .split("@")[0]
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9_.-]/g, "_")
    .replace(/^[_.-]+|[_.-]+$/g, "");
  const base = (localPart.length >= 3 ? localPart : "usuario").slice(0, 19);
  const digest = createHash("sha256").update(subject).digest("hex");

  return [
    `${base}_${digest.slice(0, 12)}`,
    `google_${digest.slice(0, 20)}`,
  ];
}

export function createAuthService({
  usersRepository,
  refreshTokenRepository,
  googleIdentityProvider,
  config,
  signAccessToken,
  clock = () => new Date(),
}) {
  function tokenHash(token) {
    return hashRefreshToken(token, config.jwtRefreshSecret);
  }

  async function createSession(user) {
    const now = clock();
    const refreshToken = createRefreshToken();
    const refreshTokenHash = tokenHash(refreshToken);
    const refreshExpiresAt = new Date(
      now.getTime() +
        durationToMilliseconds(config.jwtRefreshExpiresIn),
    );

    await refreshTokenRepository.create({
      userId: user._id,
      tokenHash: refreshTokenHash,
      expiresAt: refreshExpiresAt,
      createdAt: now,
      revokedAt: null,
      replacedByTokenHash: null,
    });

    const accessToken = await signAccessToken({
      sub: user._id.toHexString(),
      role: user.role,
      type: "access",
    });

    return {
      accessToken,
      refreshToken,
      refreshExpiresAt,
    };
  }

  async function createAuthenticatedResult(user) {
    const now = clock();
    await usersRepository.updateLastLogin(user._id, now);
    user.lastLoginAt = now;
    user.updatedAt = now;

    return {
      user: toOwnUserDto(user),
      session: await createSession(user),
    };
  }

  async function availableGoogleUsername(identity) {
    for (const username of googleUsernameCandidates(identity)) {
      const existing = await usersRepository.findByNormalizedUsername(
        normalizeUsername(username),
      );

      if (!existing) {
        return username;
      }
    }

    throw conflict(
      "No fue posible asignar un nombre de usuario",
      "GOOGLE_USERNAME_CONFLICT",
    );
  }

  async function register(input) {
    const normalizedEmail = normalizeEmail(input.email);
    const normalizedUsername = normalizeUsername(input.username);

    if (await usersRepository.findByNormalizedEmail(normalizedEmail)) {
      throw conflict("El email ya esta registrado", "EMAIL_ALREADY_EXISTS");
    }

    if (await usersRepository.findByNormalizedUsername(normalizedUsername)) {
      throw conflict(
        "El nombre de usuario ya esta registrado",
        "USERNAME_ALREADY_EXISTS",
      );
    }

    const now = clock();
    const userDocument = {
      email: input.email.trim(),
      normalizedEmail,
      username: input.username.trim(),
      normalizedUsername,
      displayName: input.displayName?.trim() ?? input.username.trim(),
      passwordHash: await hashPassword(input.password),
      role: "user",
      status: "active",
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      lastLoginAt: null,
    };
    const result = await usersRepository.create(userDocument);
    const user = {
      _id: result.insertedId,
      ...userDocument,
    };

    return {
      user: toOwnUserDto(user),
      session: await createSession(user),
    };
  }

  async function login({ identifier, password }) {
    const user = await usersRepository.findByLogin(
      normalizeUsername(identifier),
    );

    assertActiveUser(user);

    if (
      !user.passwordHash ||
      !(await verifyPassword(user.passwordHash, password))
    ) {
      throw unauthenticated();
    }

    return createAuthenticatedResult(user);
  }

  async function google(credential) {
    const identity =
      await googleIdentityProvider.verifyCredential(credential);
    const linkedUser = await usersRepository.findByGoogleSubject(
      identity.subject,
    );

    if (linkedUser) {
      assertActiveUser(linkedUser);
      return createAuthenticatedResult(linkedUser);
    }

    const normalizedEmail = normalizeEmail(identity.email);
    const existingUser =
      await usersRepository.findByNormalizedEmail(normalizedEmail);

    if (existingUser) {
      throw conflict(
        "La cuenta ya existe; inicia sesion con tu contraseña y vincula Google desde tu cuenta",
        "GOOGLE_ACCOUNT_LINK_REQUIRED",
      );
    }

    const now = clock();
    const username = await availableGoogleUsername(identity);
    const userDocument = {
      email: identity.email.trim(),
      normalizedEmail,
      username,
      normalizedUsername: normalizeUsername(username),
      displayName: identity.name?.trim().slice(0, 100) || username,
      googleSubject: identity.subject,
      role: "user",
      status: "active",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      lastLoginAt: now,
    };
    const result = await usersRepository.create(userDocument);
    const user = {
      _id: result.insertedId,
      ...userDocument,
    };

    return {
      user: toOwnUserDto(user),
      session: await createSession(user),
    };
  }

  async function linkGoogle(userId, credential) {
    const identity =
      await googleIdentityProvider.verifyCredential(credential);
    const user = await usersRepository.findById(userId);
    assertActiveUser(user);

    if (normalizeEmail(identity.email) !== user.normalizedEmail) {
      throw conflict(
        "El correo de Google debe coincidir con el correo de tu cuenta",
        "GOOGLE_EMAIL_MISMATCH",
      );
    }

    const identityOwner = await usersRepository.findByGoogleSubject(
      identity.subject,
    );
    if (identityOwner && !identityOwner._id.equals(user._id)) {
      throw conflict(
        "La identidad de Google ya esta vinculada a otra cuenta",
        "GOOGLE_IDENTITY_ALREADY_LINKED",
      );
    }

    if (user.googleSubject && user.googleSubject !== identity.subject) {
      throw conflict(
        "La cuenta ya tiene otra identidad de Google vinculada",
        "GOOGLE_IDENTITY_ALREADY_LINKED",
      );
    }

    if (user.googleSubject === identity.subject) {
      return toOwnUserDto(user);
    }

    const linkedUser = await usersRepository.linkGoogleIdentity(
      user._id,
      identity.subject,
      clock(),
    );

    if (!linkedUser) {
      throw conflict(
        "No fue posible vincular la identidad de Google",
        "GOOGLE_IDENTITY_LINK_CONFLICT",
      );
    }

    return toOwnUserDto(linkedUser);
  }

  async function refresh(rawToken) {
    if (!rawToken) {
      throw unauthenticated();
    }

    const now = clock();
    const currentHash = tokenHash(rawToken);
    const storedToken = await refreshTokenRepository.findUsable(
      currentHash,
      now,
    );

    if (!storedToken) {
      throw unauthenticated();
    }

    const user = await usersRepository.findById(storedToken.userId);

    if (!user || user.status !== "active") {
      await refreshTokenRepository.revoke(currentHash, now);
      throw unauthenticated();
    }

    const nextRawToken = createRefreshToken();
    const nextHash = tokenHash(nextRawToken);
    const refreshExpiresAt = new Date(
      now.getTime() +
        durationToMilliseconds(config.jwtRefreshExpiresIn),
    );

    await refreshTokenRepository.create({
      userId: user._id,
      tokenHash: nextHash,
      expiresAt: refreshExpiresAt,
      createdAt: now,
      revokedAt: null,
      replacedByTokenHash: null,
    });

    const rotation = await refreshTokenRepository.revokeActive(
      currentHash,
      nextHash,
      now,
    );

    if (rotation.modifiedCount !== 1) {
      await refreshTokenRepository.revoke(nextHash, now);
      throw unauthenticated();
    }

    return {
      user: toOwnUserDto(user),
      session: {
        accessToken: await signAccessToken({
          sub: user._id.toHexString(),
          role: user.role,
          type: "access",
        }),
        refreshToken: nextRawToken,
        refreshExpiresAt,
      },
    };
  }

  async function logout(rawToken) {
    if (rawToken) {
      await refreshTokenRepository.revoke(tokenHash(rawToken), clock());
    }
  }

  async function logoutAll(userId) {
    await refreshTokenRepository.revokeAllForUser(userId, clock());
  }

  async function me(userId) {
    const user = await usersRepository.findById(userId);

    if (!user || user.status !== "active") {
      throw unauthenticated();
    }

    return toOwnUserDto(user);
  }

  return Object.freeze({
    register,
    login,
    google,
    linkGoogle,
    refresh,
    logout,
    logoutAll,
    me,
  });
}
