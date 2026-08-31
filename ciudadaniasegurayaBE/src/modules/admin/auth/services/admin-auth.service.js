import { createHash, randomUUID } from "node:crypto";

import { AppError } from "../../../../shared/errors/app-error.js";
import { verifyPassword } from "../../../../shared/security/password.js";
import {
  createRefreshToken,
  durationToMilliseconds,
  hashRefreshToken,
} from "../../../../shared/security/tokens.js";
import { normalizeUsername } from "../../../../shared/utils/normalization.js";
import { toAdminSessionUserDto } from "../../../users/dto/user.dto.js";
import {
  isAdministrativeRole,
  permissionsForRole,
} from "../../permissions.js";
import {
  adminLoginAttemptKey,
  createAdminLoginBackoff,
} from "../security/admin-login-backoff.js";

const dummyPasswordHash =
  "$argon2id$v=19$m=65536,p=1,t=3$Tv/5iWF5WeStVn01eaqt1A$14vkwDS5avDIXMkbb+JcyDPwnDbP+5xrKhxg83g5Noo";

function invalidCredentials() {
  return new AppError({
    code: "ADMIN_INVALID_CREDENTIALS",
    message: "Las credenciales administrativas no son validas.",
    statusCode: 401,
  });
}

function administrativeAccessDenied() {
  return new AppError({
    code: "ADMIN_ACCESS_DENIED",
    message: "Esta cuenta no tiene permisos administrativos.",
    statusCode: 403,
  });
}

function suspendedAccount() {
  return new AppError({
    code: "ACCOUNT_SUSPENDED",
    message: "La cuenta administrativa esta suspendida.",
    statusCode: 403,
  });
}

function identifierHash(identifier) {
  return createHash("sha256")
    .update(normalizeUsername(identifier))
    .digest("hex");
}

function auditMetadata(context = {}, extra = {}) {
  return {
    ipAddress: context.ipAddress ?? null,
    userAgent: context.userAgent?.slice(0, 512) ?? null,
    ...extra,
  };
}

export function createAdminAuthService({
  usersRepository,
  adminSessionRepository,
  auditRepository,
  config,
  signAccessToken,
  loginBackoff = createAdminLoginBackoff(),
  clock = () => new Date(),
  createSessionId = randomUUID,
}) {
  function tokenHash(token) {
    return hashRefreshToken(token, config.jwtRefreshSecret);
  }

  async function recordAudit({
    user = null,
    action,
    resourceId = user?._id ?? null,
    requestId,
    metadata,
    createdAt,
  }) {
    await auditRepository.record({
      actorId: user?._id ?? null,
      actorRole: user?.role ?? null,
      action,
      resourceType: "admin_session",
      resourceId,
      metadata,
      requestId: requestId ?? null,
      createdAt,
    });
  }

  async function accessTokenFor(user, sessionId) {
    return signAccessToken({
      sub: user._id.toHexString(),
      role: user.role,
      type: "access",
      scope: "admin",
      sid: sessionId,
    });
  }

  async function createSession(user, context, sessionId = createSessionId()) {
    const now = clock();
    const refreshToken = createRefreshToken();
    const refreshExpiresAt = new Date(
      now.getTime() + durationToMilliseconds(config.jwtRefreshExpiresIn),
    );

    await adminSessionRepository.create({
      userId: user._id,
      sessionId,
      tokenHash: tokenHash(refreshToken),
      expiresAt: refreshExpiresAt,
      createdAt: now,
      revokedAt: null,
      replacedByTokenHash: null,
      lastUsedAt: null,
      ipAddress: context.ipAddress ?? null,
      userAgent: context.userAgent?.slice(0, 512) ?? null,
    });

    return {
      accessToken: await accessTokenFor(user, sessionId),
      refreshToken,
      refreshExpiresAt,
      sessionId,
    };
  }

  async function login({ identifier, password }, context = {}) {
    const now = clock();
    const attemptKey = adminLoginAttemptKey(identifier, context.ipAddress);
    try {
      await loginBackoff.beforeAttempt(attemptKey);
    } catch (error) {
      await recordAudit({
        action: "admin.login.failed",
        requestId: context.requestId,
        metadata: auditMetadata(context, {
          identifierHash: identifierHash(identifier),
          reason: "temporarily_blocked",
        }),
        createdAt: now,
      });
      throw error;
    }
    const user = await usersRepository.findByLogin(normalizeUsername(identifier));
    const passwordIsValid = await verifyPassword(
      user?.passwordHash ?? dummyPasswordHash,
      password,
    );

    if (!user || user.status === "deleted" || !passwordIsValid) {
      loginBackoff.registerFailure(attemptKey);
      await recordAudit({
        user: user?.status === "deleted" ? null : user,
        action: "admin.login.failed",
        resourceId: user?.status === "deleted" ? null : user?._id,
        requestId: context.requestId,
        metadata: auditMetadata(context, {
          identifierHash: identifierHash(identifier),
          reason: "invalid_credentials",
        }),
        createdAt: now,
      });
      throw invalidCredentials();
    }

    if (user.status === "suspended") {
      loginBackoff.registerFailure(attemptKey);
      await recordAudit({
        user,
        action: "admin.login.failed",
        requestId: context.requestId,
        metadata: auditMetadata(context, {
          identifierHash: identifierHash(identifier),
          reason: "account_suspended",
        }),
        createdAt: now,
      });
      throw suspendedAccount();
    }

    if (!isAdministrativeRole(user.role)) {
      loginBackoff.registerFailure(attemptKey);
      await recordAudit({
        user,
        action: "admin.login.failed",
        requestId: context.requestId,
        metadata: auditMetadata(context, {
          identifierHash: identifierHash(identifier),
          reason: "administrative_role_required",
        }),
        createdAt: now,
      });
      throw administrativeAccessDenied();
    }

    await usersRepository.updateLastLogin(user._id, now);
    user.lastLoginAt = now;
    user.updatedAt = now;
    const session = await createSession(user, context);

    try {
      await recordAudit({
        user,
        action: "admin.login.success",
        requestId: context.requestId,
        metadata: auditMetadata(context, {
          sessionId: session.sessionId,
        }),
        createdAt: now,
      });
    } catch (error) {
      await adminSessionRepository.revokeSession(session.sessionId, now);
      throw error;
    }
    loginBackoff.clear(attemptKey);

    return {
      user: toAdminSessionUserDto(user, permissionsForRole(user.role)),
      session,
    };
  }

  async function refresh(rawToken, context = {}) {
    if (!rawToken) {
      throw invalidCredentials();
    }

    const now = clock();
    const currentHash = tokenHash(rawToken);
    const knownToken =
      await adminSessionRepository.findByTokenHash(currentHash);

    if (!knownToken) {
      throw invalidCredentials();
    }

    if (knownToken.revokedAt) {
      await adminSessionRepository.revokeSession(knownToken.sessionId, now);
      throw invalidCredentials();
    }

    const storedToken = await adminSessionRepository.findUsable(currentHash, now);
    if (!storedToken) {
      throw invalidCredentials();
    }

    const user = await usersRepository.findById(storedToken.userId);
    if (
      !user ||
      user.status !== "active" ||
      !isAdministrativeRole(user.role)
    ) {
      await adminSessionRepository.revokeSession(storedToken.sessionId, now);
      throw invalidCredentials();
    }

    const nextRawToken = createRefreshToken();
    const nextHash = tokenHash(nextRawToken);
    const refreshExpiresAt = new Date(
      now.getTime() + durationToMilliseconds(config.jwtRefreshExpiresIn),
    );

    await adminSessionRepository.create({
      userId: user._id,
      sessionId: storedToken.sessionId,
      tokenHash: nextHash,
      expiresAt: refreshExpiresAt,
      createdAt: now,
      revokedAt: null,
      replacedByTokenHash: null,
      lastUsedAt: null,
      ipAddress: context.ipAddress ?? storedToken.ipAddress ?? null,
      userAgent:
        context.userAgent?.slice(0, 512) ?? storedToken.userAgent ?? null,
    });

    const rotation = await adminSessionRepository.rotate(
      currentHash,
      nextHash,
      now,
    );
    if (rotation.modifiedCount !== 1) {
      await adminSessionRepository.revokeToken(nextHash, now);
      throw invalidCredentials();
    }

    return {
      user: toAdminSessionUserDto(user, permissionsForRole(user.role)),
      session: {
        accessToken: await accessTokenFor(user, storedToken.sessionId),
        refreshToken: nextRawToken,
        refreshExpiresAt,
        sessionId: storedToken.sessionId,
      },
    };
  }

  async function logout(rawToken, context = {}) {
    if (!rawToken) {
      return;
    }

    const now = clock();
    const storedToken = await adminSessionRepository.findByTokenHash(
      tokenHash(rawToken),
    );
    if (!storedToken) {
      return;
    }

    await adminSessionRepository.revokeSession(storedToken.sessionId, now);
    const user = await usersRepository.findById(storedToken.userId);
    if (user) {
      await recordAudit({
        user,
        action: "admin.logout",
        requestId: context.requestId,
        metadata: auditMetadata(context, {
          sessionId: storedToken.sessionId,
        }),
        createdAt: now,
      });
    }
  }

  async function logoutAll(userId, context = {}) {
    const now = clock();
    const user = await usersRepository.findById(userId);
    if (!user || !isAdministrativeRole(user.role)) {
      throw invalidCredentials();
    }

    await adminSessionRepository.revokeAllForUser(userId, now);
    await recordAudit({
      user,
      action: "admin.logout",
      requestId: context.requestId,
      metadata: auditMetadata(context, {
        allSessions: true,
      }),
      createdAt: now,
    });
  }

  async function me(userId) {
    const user = await usersRepository.findById(userId);
    if (
      !user ||
      user.status !== "active" ||
      !isAdministrativeRole(user.role)
    ) {
      throw invalidCredentials();
    }
    return toAdminSessionUserDto(user, permissionsForRole(user.role));
  }

  return Object.freeze({
    login,
    refresh,
    logout,
    logoutAll,
    me,
  });
}
