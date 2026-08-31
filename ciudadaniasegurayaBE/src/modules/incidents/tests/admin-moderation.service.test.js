import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";

import { createIncidentsService } from "../services/incidents.service.js";

function fixture(current) {
  const incidentsRepository = {
    findById: vi.fn().mockResolvedValue(current),
    claimReviewLock: vi.fn(),
  };
  const auditRepository = { record: vi.fn() };
  const service = createIncidentsService({
    incidentsRepository,
    citiesRepository: {},
    appSettingsRepository: {},
    heatmapStatisticsService: {},
    auditRepository,
    eventBus: { publish: vi.fn() },
    cache: { get: vi.fn(), set: vi.fn() },
    config: {
      h3SupportedResolutions: [9],
      h3BaseResolution: 9,
    },
    clock: () => new Date("2026-07-29T12:05:00.000Z"),
  });
  return { auditRepository, incidentsRepository, service };
}

describe("concurrencia de moderacion de incidentes", () => {
  it("responde 409 cuando updatedAt ya no coincide", async () => {
    const actor = { id: new ObjectId(), role: "admin" };
    const { incidentsRepository, service } = fixture({
      _id: new ObjectId(),
      updatedAt: new Date("2026-07-29T12:01:00.000Z"),
      reviewLock: null,
    });

    await expect(
      service.claimReviewLock(
        new ObjectId().toHexString(),
        {
          expectedUpdatedAt: "2026-07-29T12:00:00.000Z",
          ttlSeconds: 900,
        },
        actor,
      ),
    ).rejects.toMatchObject({
      code: "INCIDENT_EDIT_CONFLICT",
      statusCode: 409,
    });
    expect(incidentsRepository.claimReviewLock).not.toHaveBeenCalled();
  });

  it("impide reclamar un bloqueo vigente de otro administrador", async () => {
    const actor = { id: new ObjectId(), role: "admin" };
    const updatedAt = new Date("2026-07-29T12:00:00.000Z");
    const { service } = fixture({
      _id: new ObjectId(),
      updatedAt,
      reviewLock: {
        lockedBy: new ObjectId(),
        lockedAt: new Date("2026-07-29T12:00:00.000Z"),
        expiresAt: new Date("2026-07-29T12:15:00.000Z"),
      },
    });

    await expect(
      service.claimReviewLock(
        new ObjectId().toHexString(),
        {
          expectedUpdatedAt: updatedAt.toISOString(),
          ttlSeconds: 900,
        },
        actor,
      ),
    ).rejects.toMatchObject({
      code: "INCIDENT_EDIT_CONFLICT",
      statusCode: 409,
    });
  });

  it("audita el reclamo exitoso del bloqueo", async () => {
    const actor = { id: new ObjectId(), role: "admin" };
    const incidentId = new ObjectId();
    const updatedAt = new Date("2026-07-29T12:00:00.000Z");
    const reviewLock = {
      lockedBy: actor.id,
      lockedAt: new Date("2026-07-29T12:05:00.000Z"),
      expiresAt: new Date("2026-07-29T12:15:00.000Z"),
    };
    const { auditRepository, incidentsRepository, service } = fixture({
      _id: incidentId,
      cityId: new ObjectId(),
      incidentType: "robo",
      title: "Incidente pendiente",
      description: "Descripcion de incidente pendiente",
      occurredAt: updatedAt,
      reportedAt: updatedAt,
      location: { type: "Point", coordinates: [-74, 4.6] },
      locationPrecision: "approximate",
      h3Index: "8966",
      h3Resolution: 9,
      sourceUrls: [],
      status: "pending",
      verification: {
        method: "none",
        confirmationCount: 0,
        verifiedAt: null,
      },
      createdAt: updatedAt,
      updatedAt,
      reviewLock: null,
      statisticsApplied: false,
    });
    incidentsRepository.claimReviewLock.mockResolvedValue({
      ...(await incidentsRepository.findById()),
      reviewLock,
      updatedAt: reviewLock.lockedAt,
    });

    await service.claimReviewLock(
      incidentId.toHexString(),
      {
        expectedUpdatedAt: updatedAt.toISOString(),
        ttlSeconds: 600,
      },
      actor,
      "request-123",
    );

    expect(auditRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "incident.review_lock.claimed",
        requestId: "request-123",
        actorId: actor.id,
      }),
    );
  });
});
