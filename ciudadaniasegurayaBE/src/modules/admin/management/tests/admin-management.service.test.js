import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";

import { createAdminManagementService } from "../services/admin-management.service.js";

const now = new Date("2026-07-29T16:00:00.000Z");

function user(overrides = {}) {
  return {
    _id: new ObjectId(),
    email: "persona@example.com",
    username: "persona",
    displayName: "Persona",
    role: "user",
    status: "active",
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function actor(role = "admin") {
  return {
    id: new ObjectId(),
    username: role,
    displayName: role,
    status: "active",
    role,
  };
}

function harness(repositoryOverrides = {}, auditOverrides = {}) {
  const repository = {
    findUser: vi.fn(),
    findUserByNormalizedUsername: vi.fn(),
    revokeSessions: vi.fn().mockResolvedValue({ modifiedCount: 0 }),
    completeRoleRequestPromotionEffects: vi
      .fn()
      .mockResolvedValue({ _id: new ObjectId() }),
    completeRoleRequestResolutionEffects: vi
      .fn()
      .mockResolvedValue({ _id: new ObjectId() }),
    rollbackDirectPromotion: vi.fn().mockResolvedValue({ _id: new ObjectId() }),
    ...repositoryOverrides,
  };
  const auditRepository = {
    record: vi.fn().mockResolvedValue({ insertedId: new ObjectId() }),
    list: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    ...auditOverrides,
  };
  const eventBus = { publish: vi.fn() };
  return {
    repository,
    auditRepository,
    eventBus,
    service: createAdminManagementService({
      repository,
      auditRepository,
      eventBus,
      clock: () => now,
    }),
  };
}

describe("admin management service", () => {
  it("habilita busqueda y exposicion de correo administrativo solo al superadmin", async () => {
    const target = user({ role: "admin" });
    const listAdministrators = vi.fn().mockResolvedValue({
      items: [target],
      total: 1,
    });
    const { service } = harness({ listAdministrators });
    const input = {
      page: 1,
      pageSize: 25,
      search: "persona@example.com",
    };

    const adminResult = await service.listAdministrators(input, actor("admin"));
    const superadminResult = await service.listAdministrators(
      input,
      actor("superadmin"),
    );

    expect(listAdministrators).toHaveBeenNthCalledWith(1, {
      ...input,
      includeEmailSearch: false,
    });
    expect(listAdministrators).toHaveBeenNthCalledWith(2, {
      ...input,
      includeEmailSearch: true,
    });
    expect(adminResult.items[0]).not.toHaveProperty("email");
    expect(superadminResult.items[0].email).toBe(target.email);
  });

  it("impide que un admin use endpoints de usuarios contra otro admin", async () => {
    const target = user({ role: "admin" });
    const { service } = harness({
      findUser: vi.fn().mockResolvedValue(target),
    });

    await expect(
      service.updateUser(
        target._id,
        {
          displayName: "Intento indebido",
          reason: "Prueba de autorizacion sobre rol administrativo",
        },
        actor("admin"),
        "request-1",
      ),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      statusCode: 403,
    });
  });

  it("promueve de forma atomica por condicion y revoca sesiones anteriores", async () => {
    const target = user();
    const promoted = {
      ...target,
      role: "admin",
      adminMetadata: {
        promotedAt: now,
        isBootstrapSuperadmin: false,
      },
    };
    const repository = {
      findUser: vi.fn().mockResolvedValue(target),
      promoteUser: vi.fn().mockResolvedValue(promoted),
      revokeSessions: vi.fn().mockResolvedValue({ modifiedCount: 2 }),
    };
    const { service, auditRepository, eventBus } = harness(repository);
    const superadmin = actor("superadmin");

    const result = await service.promoteUser(
      target._id,
      "Aprobado para apoyar la moderacion territorial",
      superadmin,
      "request-2",
    );

    expect(result).toEqual({
      userId: target._id.toHexString(),
      previousRole: "user",
      newRole: "admin",
      promotedAt: now.toISOString(),
    });
    expect(repository.promoteUser).toHaveBeenCalledWith(
      target._id,
      superadmin.id,
      expect.any(String),
      now,
    );
    expect(repository.revokeSessions).toHaveBeenCalledWith(target._id, now);
    expect(auditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorRole: "superadmin",
        action: "admin.promoted",
        reason: expect.any(String),
        requestId: "request-2",
      }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      "admin.role.updated",
      expect.objectContaining({ newRole: "admin" }),
    );
  });

  it("revierte una promocion directa si fallan sus efectos y permite reintentar", async () => {
    const target = user();
    const promoted = {
      ...target,
      role: "admin",
      adminMetadata: {
        promotedAt: now,
        isBootstrapSuperadmin: false,
      },
    };
    const repository = {
      findUser: vi.fn().mockResolvedValue(target),
      promoteUser: vi.fn().mockResolvedValue(promoted),
      revokeSessions: vi
        .fn()
        .mockRejectedValueOnce(new Error("session store unavailable"))
        .mockResolvedValue({ modifiedCount: 1 }),
      rollbackDirectPromotion: vi.fn().mockResolvedValue(target),
    };
    const { service, eventBus } = harness(repository);
    const superadmin = actor("superadmin");

    await expect(
      service.promoteUser(
        target._id,
        "Aprobado para apoyar la moderacion territorial",
        superadmin,
        "request-direct-failure",
      ),
    ).rejects.toThrow("session store unavailable");

    await expect(
      service.promoteUser(
        target._id,
        "Aprobado para apoyar la moderacion territorial",
        superadmin,
        "request-direct-retry",
      ),
    ).resolves.toMatchObject({ newRole: "admin" });

    expect(repository.rollbackDirectPromotion).toHaveBeenCalledWith(
      target._id,
      superadmin.id,
      now,
      now,
    );
    expect(repository.promoteUser).toHaveBeenCalledTimes(2);
    expect(eventBus.publish).toHaveBeenCalledOnce();
  });

  it("protege al superadmin bootstrap de degradacion", async () => {
    const target = user({
      role: "superadmin",
      adminMetadata: { isBootstrapSuperadmin: true },
    });
    const { service, repository } = harness({
      findUser: vi.fn().mockResolvedValue(target),
      demoteAdministrator: vi.fn(),
    });

    await expect(
      service.demoteAdministrator(
        target._id,
        "Intento de degradacion que debe ser rechazado",
        actor("superadmin"),
        "request-3",
      ),
    ).rejects.toMatchObject({
      code: "BOOTSTRAP_SUPERADMIN_PROTECTED",
      statusCode: 409,
    });
    expect(repository.demoteAdministrator).not.toHaveBeenCalled();
  });

  it("impide revocar sesiones de cualquier superadmin", async () => {
    const target = user({
      role: "superadmin",
      adminMetadata: { isBootstrapSuperadmin: false },
    });
    const { service, repository } = harness({
      findUser: vi.fn().mockResolvedValue(target),
    });

    await expect(
      service.revokeAdministratorSessions(
        target._id,
        "Intento que debe respetar la proteccion del superadmin.",
        actor("superadmin"),
        "request-superadmin-session",
      ),
    ).rejects.toMatchObject({
      code: "BOOTSTRAP_SUPERADMIN_PROTECTED",
      statusCode: 409,
    });
    expect(repository.revokeSessions).not.toHaveBeenCalled();
  });

  it("limita la auditoria del admin a sus propias acciones", async () => {
    const current = actor("admin");
    const auditRepository = {
      list: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    };
    const { service } = harness({}, auditRepository);

    await service.listAudit(
      { page: 1, pageSize: 25 },
      current,
    );

    expect(auditRepository.list).toHaveBeenCalledWith({
      filter: { actorId: current.id },
      skip: 0,
      limit: 25,
    });
    expect(auditRepository.count).toHaveBeenCalledWith({
      actorId: current.id,
    });
  });

  it("convierte a ObjectId el filtro global de actor en auditoria", async () => {
    const current = actor("superadmin");
    const filteredActorId = new ObjectId();
    const auditRepository = {
      list: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    };
    const { service } = harness({}, auditRepository);

    await service.listAudit(
      {
        page: 1,
        pageSize: 25,
        actorUserId: filteredActorId.toHexString(),
      },
      current,
    );

    expect(auditRepository.list).toHaveBeenCalledWith({
      filter: { actorId: filteredActorId },
      skip: 0,
      limit: 25,
    });
    expect(auditRepository.count).toHaveBeenCalledWith({
      actorId: filteredActorId,
    });
  });

  it("limita tambien la actividad reciente del dashboard para un admin", async () => {
    const current = actor("admin");
    const repository = {
      dashboard: vi.fn().mockResolvedValue({
        counts: {},
        oldestPending: [],
        recentAudit: [],
      }),
    };
    const { service } = harness(repository);

    await service.dashboard(current);

    expect(repository.dashboard).toHaveBeenCalledWith({
      actorId: current.id,
    });
  });

  it("evita solicitudes administrativas pendientes duplicadas", async () => {
    const target = user();
    const { service, repository } = harness({
      findUser: vi.fn().mockResolvedValue(target),
      findPendingRoleRequestForCandidate: vi
        .fn()
        .mockResolvedValue({ _id: new ObjectId() }),
      createRoleRequest: vi.fn(),
    });

    await expect(
      service.createRoleRequest(
        {
          motivation:
            "Quiero apoyar de forma responsable la moderacion comunitaria.",
        },
        { ...actor("user"), id: target._id },
      ),
    ).rejects.toMatchObject({
      code: "ADMIN_REQUEST_ALREADY_PENDING",
      statusCode: 409,
    });
    expect(repository.createRoleRequest).not.toHaveBeenCalled();
  });

  it("promueve con marcador antes de resolver una solicitud administrativa", async () => {
    const target = user();
    const reviewer = actor("superadmin");
    const roleRequestId = new ObjectId();
    const pendingRequest = {
      _id: roleRequestId,
      candidateUserId: target._id,
      requestedByUserId: target._id,
      requestedByRole: "user",
      motivation:
        "Quiero apoyar de forma responsable la moderacion comunitaria.",
      experience: null,
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
      resolutionReason: null,
      createdAt: now,
      updatedAt: now,
    };
    const approvedRequest = {
      ...pendingRequest,
      status: "approved",
      reviewedBy: reviewer.id,
      reviewedAt: now,
      resolutionReason: "La experiencia del candidato fue validada.",
    };
    const repository = {
      findRoleRequest: vi
        .fn()
        .mockResolvedValueOnce(pendingRequest)
        .mockResolvedValue(approvedRequest),
      findUser: vi.fn().mockResolvedValue(target),
      promoteUser: vi.fn().mockResolvedValue({
        ...target,
        role: "admin",
        adminMetadata: { promotionRequestId: roleRequestId },
      }),
      revokeSessions: vi.fn().mockResolvedValue({ modifiedCount: 1 }),
      resolveRoleRequest: vi.fn().mockResolvedValue(approvedRequest),
      rollbackRoleRequestPromotion: vi.fn(),
    };
    const { service, auditRepository, eventBus } = harness(repository);

    await service.approveRoleRequest(
      roleRequestId,
      "La experiencia del candidato fue validada.",
      reviewer,
      "request-approve",
    );

    expect(repository.promoteUser).toHaveBeenCalledWith(
      target._id,
      reviewer.id,
      "La experiencia del candidato fue validada.",
      now,
      roleRequestId,
    );
    expect(repository.resolveRoleRequest).toHaveBeenCalledWith(
      roleRequestId,
      "approved",
      reviewer.id,
      "La experiencia del candidato fue validada.",
      now,
    );
    expect(repository.rollbackRoleRequestPromotion).not.toHaveBeenCalled();
    expect(
      repository.revokeSessions.mock.invocationCallOrder[0],
    ).toBeGreaterThan(
      repository.resolveRoleRequest.mock.invocationCallOrder[0],
    );
    expect(auditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.promoted" }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      "admin.role.updated",
      expect.objectContaining({ newRole: "admin" }),
    );
  });

  it("revierte sin publicar una promocion si falla resolver la solicitud", async () => {
    const target = user();
    const reviewer = actor("superadmin");
    const roleRequestId = new ObjectId();
    const pendingRequest = {
      _id: roleRequestId,
      candidateUserId: target._id,
      requestedByUserId: target._id,
      requestedByRole: "user",
      motivation:
        "Quiero apoyar de forma responsable la moderacion comunitaria.",
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    const repository = {
      findRoleRequest: vi.fn().mockResolvedValue(pendingRequest),
      findUser: vi.fn().mockResolvedValue(target),
      promoteUser: vi.fn().mockResolvedValue({
        ...target,
        role: "admin",
        adminMetadata: { promotionRequestId: roleRequestId },
      }),
      revokeSessions: vi.fn(),
      resolveRoleRequest: vi
        .fn()
        .mockRejectedValue(new Error("database unavailable")),
      rollbackRoleRequestPromotion: vi.fn().mockResolvedValue(target),
    };
    const { service, auditRepository, eventBus } = harness(repository);

    await expect(
      service.approveRoleRequest(
        roleRequestId,
        "La experiencia del candidato fue validada.",
        reviewer,
        "request-rollback",
      ),
    ).rejects.toThrow("database unavailable");

    expect(repository.rollbackRoleRequestPromotion).toHaveBeenCalledWith(
      target._id,
      roleRequestId,
      now,
    );
    expect(repository.revokeSessions).not.toHaveBeenCalled();
    expect(auditRepository.record).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it("reanuda efectos idempotentes si la solicitud se aprobo antes de fallar", async () => {
    const target = user();
    const reviewer = actor("superadmin");
    const roleRequestId = new ObjectId();
    const pendingRequest = {
      _id: roleRequestId,
      candidateUserId: target._id,
      requestedByUserId: target._id,
      requestedByRole: "user",
      motivation:
        "Quiero apoyar de forma responsable la moderacion comunitaria.",
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    const approvedRequest = {
      ...pendingRequest,
      status: "approved",
      reviewedBy: reviewer.id,
      reviewedAt: now,
      resolutionReason: "La experiencia del candidato fue validada.",
    };
    const promotedTarget = {
      ...target,
      role: "admin",
      adminMetadata: {
        promotedAt: now,
        promotionRequestId: roleRequestId,
      },
    };
    const repository = {
      findRoleRequest: vi
        .fn()
        .mockResolvedValueOnce(pendingRequest)
        .mockResolvedValueOnce(approvedRequest)
        .mockResolvedValue(approvedRequest),
      findUser: vi
        .fn()
        .mockResolvedValueOnce(target)
        .mockResolvedValueOnce(target)
        .mockResolvedValue(promotedTarget),
      promoteUser: vi.fn().mockResolvedValue(promotedTarget),
      revokeSessions: vi
        .fn()
        .mockRejectedValueOnce(new Error("session store unavailable"))
        .mockResolvedValue({ modifiedCount: 1 }),
      resolveRoleRequest: vi.fn().mockResolvedValue(approvedRequest),
      rollbackRoleRequestPromotion: vi.fn(),
      completeRoleRequestPromotionEffects: vi
        .fn()
        .mockResolvedValue(promotedTarget),
      completeRoleRequestResolutionEffects: vi
        .fn()
        .mockResolvedValue(approvedRequest),
    };
    const { service, auditRepository, eventBus } = harness(repository);

    await expect(
      service.approveRoleRequest(
        roleRequestId,
        "La experiencia del candidato fue validada.",
        reviewer,
        "request-first-attempt",
      ),
    ).rejects.toThrow("session store unavailable");

    await expect(
      service.approveRoleRequest(
        roleRequestId,
        "La experiencia del candidato fue validada.",
        reviewer,
        "request-retry",
      ),
    ).resolves.toMatchObject({ status: "approved" });

    expect(repository.promoteUser).toHaveBeenCalledOnce();
    expect(repository.resolveRoleRequest).toHaveBeenCalledOnce();
    expect(repository.rollbackRoleRequestPromotion).not.toHaveBeenCalled();
    expect(repository.revokeSessions).toHaveBeenCalledTimes(2);
    expect(auditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "admin.promoted",
        operationKey: `admin-role-request:${roleRequestId.toHexString()}:promotion`,
      }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      "admin.request.resolved",
      expect.objectContaining({ status: "approved" }),
    );
  });

  it("finaliza idempotentemente una solicitud cuya promocion quedo marcada", async () => {
    const reviewer = actor("superadmin");
    const roleRequestId = new ObjectId();
    const target = user({
      role: "admin",
      adminMetadata: { promotionRequestId: roleRequestId },
    });
    const pendingRequest = {
      _id: roleRequestId,
      candidateUserId: target._id,
      requestedByUserId: target._id,
      requestedByRole: "user",
      motivation:
        "Quiero apoyar de forma responsable la moderacion comunitaria.",
      experience: null,
      status: "pending",
      reviewedBy: null,
      reviewedAt: null,
      resolutionReason: null,
      createdAt: now,
      updatedAt: now,
    };
    const repository = {
      findRoleRequest: vi
        .fn()
        .mockResolvedValueOnce(pendingRequest)
        .mockResolvedValue({ ...pendingRequest, status: "approved" }),
      findUser: vi.fn().mockResolvedValue(target),
      promoteUser: vi.fn(),
      revokeSessions: vi.fn(),
      resolveRoleRequest: vi
        .fn()
        .mockResolvedValue({ ...pendingRequest, status: "approved" }),
      rollbackRoleRequestPromotion: vi.fn(),
    };
    const { service, auditRepository, eventBus } = harness(repository);

    await service.approveRoleRequest(
      roleRequestId,
      "Se recupera una promocion confirmada previamente.",
      reviewer,
      "request-recovery",
    );

    expect(repository.promoteUser).not.toHaveBeenCalled();
    expect(repository.revokeSessions).toHaveBeenCalledWith(
      target._id,
      now,
    );
    expect(repository.resolveRoleRequest).toHaveBeenCalledOnce();
    expect(repository.rollbackRoleRequestPromotion).not.toHaveBeenCalled();
    expect(auditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "admin.promoted" }),
    );
    expect(eventBus.publish).toHaveBeenCalledWith(
      "admin.role.updated",
      expect.objectContaining({ newRole: "admin" }),
    );
  });
});
