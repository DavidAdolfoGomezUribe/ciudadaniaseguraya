import { randomUUID } from "node:crypto";

import {
  conflict,
  forbidden,
  notFound,
} from "../../../../shared/errors/app-error.js";
import { hashPassword } from "../../../../shared/security/password.js";
import { normalizeUsername } from "../../../../shared/utils/normalization.js";
import { toObjectId } from "../../../../shared/utils/object-id.js";
import {
  hasPermission,
  PERMISSIONS,
} from "../../permissions.js";

function idOf(value) {
  if (!value) return null;
  return typeof value === "string" ? value : value.toHexString();
}

function iso(value) {
  return value?.toISOString?.() ?? value ?? null;
}

function userDto(user, { exposeEmail = true } = {}) {
  const dto = {
    id: idOf(user._id),
    username: user.username,
    displayName: user.displayName ?? null,
    role: user.role,
    status: user.status,
    emailVerified: user.emailVerified,
    createdAt: iso(user.createdAt),
    updatedAt: iso(user.updatedAt),
    lastLoginAt: iso(user.lastLoginAt),
    deletedAt: iso(user.deletedAt),
    promotedAt: iso(user.adminMetadata?.promotedAt),
    isBootstrapSuperadmin:
      user.adminMetadata?.isBootstrapSuperadmin === true,
  };

  if (exposeEmail) dto.email = user.email;
  if (user.incidentCount !== undefined) {
    dto.incidentCount = user.incidentCount;
    dto.postCount = user.postCount;
    dto.commentCount = user.commentCount;
    dto.adminRequestStatus = user.adminRequestStatus;
  }
  return dto;
}

function roleRequestDto(request, related = {}) {
  return {
    id: idOf(request._id),
    candidateUserId: idOf(request.candidateUserId),
    requestedByUserId: idOf(request.requestedByUserId),
    requestedByRole: request.requestedByRole,
    motivation: request.motivation,
    experience: request.experience ?? null,
    status: request.status,
    reviewedBy: idOf(request.reviewedBy),
    reviewedAt: iso(request.reviewedAt),
    resolutionReason: request.resolutionReason ?? null,
    informationRequests: (request.informationRequests ?? []).map((item) => ({
      requestedBy: idOf(item.requestedBy),
      requestedAt: iso(item.requestedAt),
      message: item.message,
    })),
    createdAt: iso(request.createdAt),
    updatedAt: iso(request.updatedAt),
    candidate: related.candidate
      ? userDto(related.candidate, { exposeEmail: false })
      : undefined,
    requestedBy: related.requestedBy
      ? userDto(related.requestedBy, { exposeEmail: false })
      : undefined,
  };
}

function auditDto(log) {
  return {
    id: idOf(log._id),
    actorUserId: idOf(log.actorUserId ?? log.actorId),
    actorRole: log.actorRole ?? null,
    action: log.action,
    resourceType: log.resourceType,
    resourceId: idOf(log.resourceId),
    previousValue: log.previousValue ?? null,
    newValue: log.newValue ?? log.changes ?? null,
    reason: log.reason ?? null,
    metadata: log.metadata ?? null,
    requestId: log.requestId ?? null,
    createdAt: iso(log.createdAt),
  };
}

export function createAdminManagementService({
  repository,
  auditRepository,
  eventBus,
  clock = () => new Date(),
  createAnonymousId = randomUUID,
}) {
  async function record({
    actor,
    action,
    resourceType,
    resourceId,
    previousValue,
    newValue,
    reason,
    metadata,
    requestId,
    operationKey,
  }) {
    await auditRepository.record({
      actorId: actor.id,
      actorUserId: actor.id,
      actorRole: actor.role,
      action,
      resourceType,
      resourceId,
      previousValue,
      newValue,
      changes: newValue,
      reason,
      metadata,
      requestId,
      operationKey,
      createdAt: clock(),
    });
  }

  async function assertNormalUser(userId) {
    const user = await repository.findUser(userId);
    if (!user) throw notFound("Usuario");
    if (user.role !== "user") {
      throw forbidden("No tienes permisos para modificar esta cuenta administrativa.");
    }
    return user;
  }

  async function assertAdministrator(adminId) {
    const user = await repository.findUser(adminId);
    if (!user) throw notFound("Administrador");
    if (!["admin", "superadmin"].includes(user.role)) {
      throw conflict("La cuenta no es administrativa", "NOT_ADMINISTRATOR");
    }
    return user;
  }

  async function listUsers(input) {
    const result = await repository.listUsers(input);
    return {
      items: result.items.map((user) => userDto(user)),
      total: result.total,
    };
  }

  async function getUser(userId) {
    return userDto(await assertNormalUser(userId));
  }

  async function updateUser(userId, input, actor, requestId) {
    const current = await assertNormalUser(userId);
    const changes = {};
    if (input.displayName !== undefined) {
      changes.displayName = input.displayName || null;
    }
    if (input.username !== undefined) {
      const normalizedUsername = normalizeUsername(input.username);
      const owner =
        await repository.findUserByNormalizedUsername(normalizedUsername);
      if (owner && !owner._id.equals(current._id)) {
        throw conflict(
          "El nombre de usuario ya esta registrado",
          "USERNAME_ALREADY_EXISTS",
        );
      }
      changes.username = input.username.trim();
      changes.normalizedUsername = normalizedUsername;
    }

    const updated = await repository.updateNormalUser(
      userId,
      changes,
      clock(),
    );
    if (!updated) throw conflict("El usuario fue modificado por otro proceso");

    await record({
      actor,
      action: "user.updated",
      resourceType: "user",
      resourceId: current._id,
      previousValue: {
        username: current.username,
        displayName: current.displayName ?? null,
      },
      newValue: changes,
      reason: input.reason,
      requestId,
    });
    eventBus.publish("admin.user.updated", {
      userId: idOf(current._id),
      actorUserId: idOf(actor.id),
    });
    return userDto(updated);
  }

  async function changeNormalUserStatus(
    userId,
    status,
    reason,
    actor,
    requestId,
  ) {
    const current = await assertNormalUser(userId);
    if (current.status === "deleted") {
      throw conflict("La cuenta eliminada no puede reactivarse", "DELETED_ACCOUNT");
    }

    const updated = await repository.updateNormalUserStatus(
      userId,
      status,
      reason,
      clock(),
    );
    if (!updated) throw conflict("El usuario fue modificado por otro proceso");
    if (status === "suspended") {
      await repository.revokeSessions(userId, clock());
    }
    await record({
      actor,
      action: status === "suspended" ? "user.suspended" : "user.reactivated",
      resourceType: "user",
      resourceId: current._id,
      previousValue: { status: current.status },
      newValue: { status },
      reason,
      requestId,
    });
    eventBus.publish(
      status === "suspended"
        ? "admin.user.suspended"
        : "admin.user.updated",
      { userId: idOf(current._id), status },
    );
    return userDto(updated);
  }

  async function deleteUser(userId, input, actor, requestId) {
    const current = await assertNormalUser(userId);
    if (input.confirmation !== "ELIMINAR") {
      throw conflict(
        "La confirmacion de eliminacion no coincide",
        "DELETE_CONFIRMATION_REQUIRED",
      );
    }
    const now = clock();
    const suffix = createAnonymousId().replaceAll("-", "");
    const anonymousUsername = `usuario_eliminado_${suffix.slice(0, 12)}`;
    const anonymousEmail = `deleted-${suffix}@anonymous.invalid`;
    const deleted = await repository.deleteNormalUser(
      userId,
      {
        email: anonymousEmail,
        normalizedEmail: anonymousEmail,
        username: anonymousUsername,
        normalizedUsername: anonymousUsername,
        displayName: null,
        passwordHash: await hashPassword(suffix),
      },
      input.reason,
      actor.id,
      now,
    );
    if (!deleted) throw conflict("El usuario fue modificado por otro proceso");
    await Promise.all([
      repository.revokeSessions(userId, now),
      repository.markContentFromDeletedAuthor(userId, now),
    ]);
    await record({
      actor,
      action: "user.deleted",
      resourceType: "user",
      resourceId: current._id,
      previousValue: {
        username: current.username,
        email: current.email,
        status: current.status,
      },
      newValue: { status: "deleted", anonymized: true },
      reason: input.reason,
      requestId,
    });
    eventBus.publish("admin.user.updated", {
      userId: idOf(current._id),
      status: "deleted",
    });
  }

  async function revokeUserSessions(userId, reason, actor, requestId) {
    const current = await assertNormalUser(userId);
    const result = await repository.revokeSessions(userId, clock());
    await record({
      actor,
      action: "user.sessions.revoked",
      resourceType: "user",
      resourceId: current._id,
      newValue: { revokedSessions: result.modifiedCount },
      reason,
      requestId,
    });
    return { userId: idOf(current._id), revokedSessions: result.modifiedCount };
  }

  async function listAdministrators(input, actor) {
    const canManageAdministrators = hasPermission(
      actor.role,
      PERMISSIONS.ADMINS_UPDATE,
    );
    const result = await repository.listAdministrators({
      ...input,
      includeEmailSearch: canManageAdministrators,
    });
    return {
      items: result.items.map((user) =>
        userDto(user, {
          exposeEmail: canManageAdministrators,
        }),
      ),
      total: result.total,
    };
  }

  async function getAdministrator(adminId, actor) {
    const admin = await assertAdministrator(adminId);
    return userDto(admin, {
      exposeEmail: hasPermission(actor.role, PERMISSIONS.ADMINS_UPDATE),
    });
  }

  async function finalizePromotion({
    userId,
    reason,
    actor,
    requestId,
    occurredAt,
    roleRequestId = null,
    effectsAlreadyCompleted = false,
  }) {
    if (effectsAlreadyCompleted) {
      return false;
    }
    await repository.revokeSessions(userId, occurredAt);
    await record({
      actor,
      action: "admin.promoted",
      resourceType: "user",
      resourceId: userId,
      previousValue: { role: "user" },
      newValue: { role: "admin" },
      reason,
      requestId,
      operationKey: roleRequestId
        ? `admin-role-request:${idOf(roleRequestId)}:promotion`
        : undefined,
    });
    if (roleRequestId) {
      const completed =
        await repository.completeRoleRequestPromotionEffects(
          userId,
          roleRequestId,
          clock(),
        );
      if (!completed) {
        return false;
      }
    }
    eventBus.publish("admin.role.updated", {
      userId: idOf(userId),
      previousRole: "user",
      newRole: "admin",
    });
    return true;
  }

  async function promoteUser(
    userId,
    reason,
    actor,
    requestId,
    roleRequestId,
    { deferSideEffects = false } = {},
  ) {
    const current = await assertNormalUser(userId);
    if (current.status !== "active") {
      throw conflict(
        "Solo una cuenta activa puede promoverse",
        "USER_NOT_ACTIVE",
      );
    }
    const now = clock();
    const updated = roleRequestId
      ? await repository.promoteUser(
          userId,
          actor.id,
          reason,
          now,
          roleRequestId,
        )
      : await repository.promoteUser(userId, actor.id, reason, now);
    if (!updated) {
      throw conflict(
        "El usuario ya no puede promoverse",
        "ROLE_UPDATE_CONFLICT",
      );
    }
    try {
      if (!deferSideEffects) {
        await finalizePromotion({
          userId: current._id,
          reason,
          actor,
          requestId,
          occurredAt: now,
        });
      }
    } catch (error) {
      if (roleRequestId) {
        await repository.rollbackRoleRequestPromotion(
          userId,
          roleRequestId,
          clock(),
        );
      } else {
        await repository.rollbackDirectPromotion(
          userId,
          actor.id,
          now,
          clock(),
        );
      }
      throw error;
    }
    return {
      userId: idOf(current._id),
      previousRole: "user",
      newRole: "admin",
      promotedAt: now.toISOString(),
    };
  }

  async function demoteAdministrator(adminId, reason, actor, requestId) {
    const current = await assertAdministrator(adminId);
    if (current.role === "superadmin" || current.adminMetadata?.isBootstrapSuperadmin) {
      throw conflict(
        "El superadmin principal no puede degradarse",
        "BOOTSTRAP_SUPERADMIN_PROTECTED",
      );
    }
    if (current._id.equals(actor.id)) {
      throw forbidden("No puedes degradar tu propia cuenta");
    }
    const now = clock();
    const updated = await repository.demoteAdministrator(
      adminId,
      actor.id,
      reason,
      now,
    );
    if (!updated) throw conflict("El administrador fue modificado por otro proceso");
    await repository.revokeSessions(adminId, now, "admin");
    await record({
      actor,
      action: "admin.demoted",
      resourceType: "user",
      resourceId: current._id,
      previousValue: { role: "admin" },
      newValue: { role: "user" },
      reason,
      requestId,
    });
    eventBus.publish("admin.role.updated", {
      userId: idOf(current._id),
      previousRole: "admin",
      newRole: "user",
    });
    return userDto(updated);
  }

  async function changeAdministratorStatus(
    adminId,
    status,
    reason,
    actor,
    requestId,
  ) {
    const current = await assertAdministrator(adminId);
    if (
      current.role === "superadmin" ||
      current.adminMetadata?.isBootstrapSuperadmin
    ) {
      throw conflict(
        "El superadmin principal no puede suspenderse",
        "BOOTSTRAP_SUPERADMIN_PROTECTED",
      );
    }
    if (current._id.equals(actor.id)) {
      throw forbidden("No puedes cambiar el estado de tu propia cuenta");
    }
    const now = clock();
    const updated = await repository.updateAdministratorStatus(
      adminId,
      status,
      reason,
      now,
    );
    if (!updated) throw conflict("El administrador fue modificado por otro proceso");
    if (status === "suspended") {
      await repository.revokeSessions(adminId, now, "admin");
    }
    await record({
      actor,
      action:
        status === "suspended"
          ? "admin.suspended"
          : "admin.reactivated",
      resourceType: "user",
      resourceId: current._id,
      previousValue: { status: current.status },
      newValue: { status },
      reason,
      requestId,
    });
    eventBus.publish("admin.user.updated", {
      userId: idOf(current._id),
      status,
    });
    return userDto(updated);
  }

  async function revokeAdministratorSessions(
    adminId,
    reason,
    actor,
    requestId,
  ) {
    const current = await assertAdministrator(adminId);
    if (
      current.role === "superadmin" ||
      current.adminMetadata?.isBootstrapSuperadmin
    ) {
      throw conflict(
        "Las sesiones del superadmin principal no pueden revocarse desde este endpoint",
        "BOOTSTRAP_SUPERADMIN_PROTECTED",
      );
    }
    if (current._id.equals(actor.id)) {
      throw forbidden("Utiliza cerrar todas las sesiones para tu propia cuenta");
    }
    const result = await repository.revokeSessions(adminId, clock(), "admin");
    await record({
      actor,
      action: "admin.session.revoked",
      resourceType: "user",
      resourceId: current._id,
      newValue: { revokedSessions: result.modifiedCount },
      reason,
      requestId,
    });
    return { adminId: idOf(current._id), revokedSessions: result.modifiedCount };
  }

  async function createRoleRequest(
    input,
    actor,
    candidateUserId = actor.id,
    requestId,
  ) {
    const candidate = await assertNormalUser(candidateUserId);
    if (candidate.status !== "active") {
      throw conflict("La cuenta candidata debe estar activa", "USER_NOT_ACTIVE");
    }
    if (await repository.findPendingRoleRequestForCandidate(candidate._id)) {
      throw conflict(
        "Ya existe una solicitud pendiente para este usuario",
        "ADMIN_REQUEST_ALREADY_PENDING",
      );
    }
    const now = clock();
    const document = {
      candidateUserId: candidate._id,
      requestedByUserId: actor.id,
      requestedByRole: actor.role,
      motivation: input.motivation,
      experience: input.experience ?? null,
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
      resolutionReason: null,
      createdAt: now,
      updatedAt: now,
    };
    let result;
    try {
      result = await repository.createRoleRequest(document);
    } catch (error) {
      if (error?.code === 11000) {
        throw conflict(
          "Ya existe una solicitud pendiente para este usuario",
          "ADMIN_REQUEST_ALREADY_PENDING",
        );
      }
      throw error;
    }
    const request = { _id: result.insertedId, ...document };
    await record({
      actor,
      action: "admin_request.created",
      resourceType: "admin_role_request",
      resourceId: request._id,
      newValue: {
        candidateUserId: idOf(candidate._id),
        status: "pending",
      },
      reason: input.motivation,
      requestId,
    });
    eventBus.publish("admin.request.created", {
      requestId: idOf(request._id),
      candidateUserId: idOf(candidate._id),
    });
    return roleRequestDto(request, { candidate });
  }

  async function enrichRequests(items) {
    return Promise.all(
      items.map(async (request) => {
        const [candidate, requestedBy] = await Promise.all([
          repository.findUser(request.candidateUserId),
          repository.findUser(request.requestedByUserId),
        ]);
        return roleRequestDto(request, { candidate, requestedBy });
      }),
    );
  }

  async function listOwnRoleRequests(actor, input) {
    const result = await repository.listOwnRoleRequests(actor.id, input);
    return {
      items: await enrichRequests(result.items),
      total: result.total,
    };
  }

  async function listRoleRequests(input) {
    const result = await repository.listRoleRequests(input);
    return {
      items: await enrichRequests(result.items),
      total: result.total,
    };
  }

  async function getRoleRequest(requestId) {
    const request = await repository.findRoleRequest(requestId);
    if (!request) throw notFound("Solicitud administrativa");
    const [candidate, requestedBy] = await Promise.all([
      repository.findUser(request.candidateUserId),
      repository.findUser(request.requestedByUserId),
    ]);
    return roleRequestDto(request, { candidate, requestedBy });
  }

  async function cancelRoleRequest(requestId, actor, requestIdHeader) {
    const cancelled = await repository.cancelRoleRequest(
      requestId,
      actor.id,
      clock(),
    );
    if (!cancelled) {
      throw conflict(
        "La solicitud no puede cancelarse",
        "ADMIN_REQUEST_NOT_CANCELLABLE",
      );
    }
    await record({
      actor,
      action: "admin_request.cancelled",
      resourceType: "admin_role_request",
      resourceId: cancelled._id,
      previousValue: { status: "pending" },
      newValue: { status: "cancelled" },
      reason: "Solicitud cancelada por quien la creo o por el candidato",
      requestId: requestIdHeader,
    });
    eventBus.publish("admin.request.resolved", {
      requestId: idOf(cancelled._id),
      status: "cancelled",
    });
    return roleRequestDto(cancelled);
  }

  async function approveRoleRequest(requestId, reason, actor, requestIdHeader) {
    const request = await repository.findRoleRequest(requestId);
    if (!request) throw notFound("Solicitud administrativa");
    const candidate = await repository.findUser(request.candidateUserId);
    if (!candidate) throw notFound("Usuario candidato");
    const recoveringPromotion =
      candidate.role === "admin" &&
      candidate.adminMetadata?.promotionRequestId?.equals?.(request._id);
    const resumingApprovedRequest =
      request.status === "approved" && recoveringPromotion;
    if (request.status !== "pending" && !resumingApprovedRequest) {
      throw conflict(
        "La solicitud ya fue resuelta",
        "ADMIN_REQUEST_ALREADY_RESOLVED",
      );
    }
    let promotedNow = false;
    let promotionOccurredAt = candidate.adminMetadata?.promotedAt ?? clock();
    try {
      if (request.status === "pending" && !recoveringPromotion) {
        const promotion = await promoteUser(
          request.candidateUserId,
          reason,
          actor,
          requestIdHeader,
          request._id,
          { deferSideEffects: true },
        );
        promotedNow = true;
        promotionOccurredAt = new Date(promotion.promotedAt);
      }
      if (request.status === "pending") {
        const resolved = await repository.resolveRoleRequest(
          requestId,
          "approved",
          actor.id,
          reason,
          clock(),
        );
        if (!resolved) throw conflict("La solicitud ya fue resuelta");
      }
    } catch (error) {
      if (promotedNow) {
        await repository.rollbackRoleRequestPromotion(
          request.candidateUserId,
          request._id,
          clock(),
        );
      }
      throw error;
    }
    await finalizePromotion({
      userId: request.candidateUserId,
      reason,
      actor,
      requestId: requestIdHeader,
      occurredAt: promotionOccurredAt,
      roleRequestId: request._id,
      effectsAlreadyCompleted:
        candidate.adminMetadata?.promotionEffectsCompletedAt != null,
    });
    await record({
      actor,
      action: "admin_request.approved",
      resourceType: "admin_role_request",
      resourceId: request._id,
      previousValue: { status: "pending" },
      newValue: { status: "approved" },
      reason,
      requestId: requestIdHeader,
      operationKey: `admin-role-request:${idOf(request._id)}:approved`,
    });
    if (!request.resolutionEffectsCompletedAt) {
      const completed =
        await repository.completeRoleRequestResolutionEffects(
          request._id,
          clock(),
        );
      if (completed) {
        eventBus.publish("admin.request.resolved", {
          requestId: idOf(request._id),
          status: "approved",
        });
      }
    }
    return getRoleRequest(requestId);
  }

  async function rejectRoleRequest(requestId, reason, actor, requestIdHeader) {
    const request = await repository.resolveRoleRequest(
      requestId,
      "rejected",
      actor.id,
      reason,
      clock(),
    );
    if (!request) {
      throw conflict(
        "La solicitud no existe o ya fue resuelta",
        "ADMIN_REQUEST_ALREADY_RESOLVED",
      );
    }
    await record({
      actor,
      action: "admin_request.rejected",
      resourceType: "admin_role_request",
      resourceId: request._id,
      previousValue: { status: "pending" },
      newValue: { status: "rejected" },
      reason,
      requestId: requestIdHeader,
    });
    eventBus.publish("admin.request.resolved", {
      requestId: idOf(request._id),
      status: "rejected",
    });
    return getRoleRequest(requestId);
  }

  async function requestRoleInformation(
    requestId,
    reason,
    actor,
    requestIdHeader,
  ) {
    const request = await repository.requestRoleInformation(
      requestId,
      actor.id,
      reason,
      clock(),
    );
    if (!request) {
      throw conflict(
        "La solicitud no existe o ya fue resuelta",
        "ADMIN_REQUEST_ALREADY_RESOLVED",
      );
    }
    await record({
      actor,
      action: "admin_request.information_requested",
      resourceType: "admin_role_request",
      resourceId: request._id,
      previousValue: { status: "pending" },
      newValue: {
        status: "pending",
        informationRequested: true,
      },
      reason,
      requestId: requestIdHeader,
    });
    eventBus.publish("admin.request.updated", {
      requestId: idOf(request._id),
      status: "pending",
      informationRequested: true,
    });
    return getRoleRequest(requestId);
  }

  async function dashboard(actor) {
    const auditFilter = hasPermission(
      actor.role,
      PERMISSIONS.AUDIT_READ_ALL,
    )
      ? {}
      : { actorId: actor.id };
    const data = await repository.dashboard(auditFilter);
    return {
      ...data,
      oldestPending: data.oldestPending.map((incident) => ({
        id: idOf(incident._id),
        title: incident.title,
        incidentType: incident.incidentType,
        cityId: idOf(incident.cityId),
        createdAt: iso(incident.createdAt),
      })),
      recentAudit: data.recentAudit.map(auditDto),
      services: {
        backend: "available",
        realtime: "available",
      },
    };
  }

  async function listAudit(input, actor) {
    const filter = {};
    const canReadAll = hasPermission(
      actor.role,
      PERMISSIONS.AUDIT_READ_ALL,
    );
    if (!canReadAll) filter.actorId = actor.id;
    if (input.actorUserId && canReadAll) {
      filter.actorId = toObjectId(input.actorUserId);
    }
    if (input.role) filter.actorRole = input.role;
    if (input.action) filter.action = input.action;
    if (input.resourceType) filter.resourceType = input.resourceType;
    if (input.requestId) filter.requestId = input.requestId;
    if (input.from || input.to) {
      filter.createdAt = {};
      if (input.from) filter.createdAt.$gte = input.from;
      if (input.to) filter.createdAt.$lte = input.to;
    }
    const [logs, total] = await Promise.all([
      auditRepository.list({
        filter,
        skip: (input.page - 1) * input.pageSize,
        limit: input.pageSize,
      }),
      auditRepository.count(filter),
    ]);
    return { items: logs.map(auditDto), total };
  }

  async function listSettings() {
    const items = await repository.listSettings();
    return items.map((setting) => ({
      id: idOf(setting._id),
      key: setting.key,
      value: setting.value,
      editable: true,
      type: typeof setting.value,
      updatedAt: iso(setting.updatedAt),
    }));
  }

  async function updateSetting(input, actor, requestId) {
    const current = (await repository.listSettings()).find(
      (setting) => setting.key === input.key,
    );
    const updated = await repository.updateSetting(
      input.key,
      input.value,
      clock(),
    );
    await record({
      actor,
      action: "settings.updated",
      resourceType: "app_setting",
      resourceId: updated._id,
      previousValue: { value: current?.value ?? null },
      newValue: { value: updated.value },
      reason: input.reason,
      requestId,
    });
    return {
      id: idOf(updated._id),
      key: updated.key,
      value: updated.value,
      updatedAt: iso(updated.updatedAt),
    };
  }

  return Object.freeze({
    listUsers,
    getUser,
    updateUser,
    suspendUser: (id, reason, actor, requestId) =>
      changeNormalUserStatus(id, "suspended", reason, actor, requestId),
    reactivateUser: (id, reason, actor, requestId) =>
      changeNormalUserStatus(id, "active", reason, actor, requestId),
    deleteUser,
    revokeUserSessions,
    listAdministrators,
    getAdministrator,
    promoteUser,
    demoteAdministrator,
    suspendAdministrator: (id, reason, actor, requestId) =>
      changeAdministratorStatus(id, "suspended", reason, actor, requestId),
    reactivateAdministrator: (id, reason, actor, requestId) =>
      changeAdministratorStatus(id, "active", reason, actor, requestId),
    revokeAdministratorSessions,
    createRoleRequest,
    listOwnRoleRequests,
    listRoleRequests,
    getRoleRequest,
    cancelRoleRequest,
    approveRoleRequest,
    rejectRoleRequest,
    requestRoleInformation,
    dashboard,
    listAudit,
    listSettings,
    updateSetting,
  });
}
