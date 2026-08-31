import { randomUUID } from "node:crypto";

import {
  conflict,
  forbidden,
  notFound,
} from "../../../shared/errors/app-error.js";
import { hashPassword } from "../../../shared/security/password.js";
import {
  normalizeEmail,
  normalizeUsername,
} from "../../../shared/utils/normalization.js";
import {
  toAdminUserDto,
  toOwnUserDto,
  toPublicUserDto,
} from "../dto/user.dto.js";

export function createUsersService({
  usersRepository,
  refreshTokenRepository,
  auditRepository,
  accountContentRepository,
  clock = () => new Date(),
  createAnonymousId = randomUUID,
}) {
  async function assertNormalAccount(userId) {
    const user = await usersRepository.findById(userId);
    if (!user) {
      throw notFound("Usuario");
    }
    if (user.role !== "user") {
      throw forbidden(
        "Las cuentas administrativas no pueden modificarse desde el perfil ciudadano",
      );
    }
    return user;
  }

  async function getPublic(userId) {
    const user = await usersRepository.findPublicById(userId);

    if (!user) {
      throw notFound("Usuario");
    }

    return toPublicUserDto(user);
  }

  async function updateOwn(userId, input) {
    await assertNormalAccount(userId);
    const changes = {};

    if (input.email) {
      const normalizedEmail = normalizeEmail(input.email);
      const existing =
        await usersRepository.findByNormalizedEmail(normalizedEmail);

      if (existing && !existing._id.equals(userId)) {
        throw conflict("El email ya esta registrado", "EMAIL_ALREADY_EXISTS");
      }

      changes.email = input.email.trim();
      changes.normalizedEmail = normalizedEmail;
      changes.emailVerified = false;
    }

    if (input.username) {
      const normalizedUsername = normalizeUsername(input.username);
      const existing =
        await usersRepository.findByNormalizedUsername(normalizedUsername);

      if (existing && !existing._id.equals(userId)) {
        throw conflict(
          "El nombre de usuario ya esta registrado",
          "USERNAME_ALREADY_EXISTS",
        );
      }

      changes.username = input.username.trim();
      changes.normalizedUsername = normalizedUsername;
    }

    if (input.displayName) {
      changes.displayName = input.displayName.trim();
    }

    const user = await usersRepository.updateProfile(
      userId,
      changes,
      clock(),
    );

    if (!user) {
      throw notFound("Usuario");
    }

    return toOwnUserDto(user);
  }

  async function deleteOwn(userId) {
    await assertNormalAccount(userId);
    const suffix = createAnonymousId().replaceAll("-", "");
    const now = clock();
    const user = await usersRepository.anonymize(
      userId,
      {
        email: `deleted-${suffix}@anonymous.invalid`,
        normalizedEmail: `deleted-${suffix}@anonymous.invalid`,
        username: `usuario_eliminado_${suffix.slice(0, 12)}`,
        normalizedUsername: `usuario_eliminado_${suffix.slice(0, 12)}`,
        passwordHash: await hashPassword(suffix),
      },
      now,
    );

    if (!user) {
      throw notFound("Usuario");
    }

    await refreshTokenRepository.revokeAllForUser(userId, now);
    await accountContentRepository?.markAuthorDeleted(userId, now);
  }

  async function listAdmin({ page, pageSize, status, role }) {
    const filter = {};
    if (status) {
      filter.status = status;
    }
    if (role) {
      filter.role = role;
    }

    const [users, total] = await Promise.all([
      usersRepository.list({
        filter,
        skip: (page - 1) * pageSize,
        limit: pageSize,
      }),
      usersRepository.count(filter),
    ]);

    return {
      users: users.map(toAdminUserDto),
      total,
    };
  }

  async function getAdmin(userId) {
    const user = await usersRepository.findById(userId);

    if (!user) {
      throw notFound("Usuario");
    }

    return toAdminUserDto(user);
  }

  async function updateStatus({
    actorId,
    userId,
    status,
  }) {
    if (actorId.equals(userId)) {
      throw forbidden("No puedes cambiar el estado de tu propia cuenta");
    }

    const current = await usersRepository.findById(userId);
    if (!current) {
      throw notFound("Usuario");
    }
    if (current.status === "deleted") {
      throw conflict(
        "Una cuenta eliminada no puede reactivarse",
        "DELETED_ACCOUNT",
      );
    }

    const now = clock();
    const updated = await usersRepository.updateStatus(userId, status, now);

    if (status === "suspended") {
      await refreshTokenRepository.revokeAllForUser(userId, now);
    }

    await auditRepository.record({
      actorId,
      action: status === "suspended" ? "user.suspended" : "user.reactivated",
      resourceType: "user",
      resourceId: userId,
      changes: {
        previousStatus: current.status,
        status,
      },
      createdAt: now,
    });

    return toAdminUserDto(updated);
  }

  async function listAuditLogs({
    page,
    pageSize,
    action,
    resourceType,
  }) {
    const filter = {};
    if (action) {
      filter.action = action;
    }
    if (resourceType) {
      filter.resourceType = resourceType;
    }

    const [logs, total] = await Promise.all([
      auditRepository.list({
        filter,
        skip: (page - 1) * pageSize,
        limit: pageSize,
      }),
      auditRepository.count(filter),
    ]);

    return {
      logs: logs.map((log) => ({
        id: log._id.toHexString(),
        actorId: log.actorId?.toHexString() ?? null,
        actorRole: log.actorRole ?? null,
        action: log.action,
        resourceType: log.resourceType,
        resourceId:
          typeof log.resourceId?.toHexString === "function"
            ? log.resourceId.toHexString()
            : (log.resourceId ?? null),
        changes: log.changes,
        previousValue: log.previousValue ?? null,
        newValue: log.newValue ?? null,
        reason: log.reason ?? null,
        metadata: log.metadata ?? {},
        requestId: log.requestId ?? null,
        createdAt: log.createdAt.toISOString(),
      })),
      total,
    };
  }

  return Object.freeze({
    getPublic,
    updateOwn,
    deleteOwn,
    listAdmin,
    getAdmin,
    updateStatus,
    listAuditLogs,
  });
}
