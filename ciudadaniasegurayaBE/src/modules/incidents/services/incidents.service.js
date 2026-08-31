import { MongoServerError } from "mongodb";

import {
  AppError,
  conflict,
  forbidden,
  notFound,
} from "../../../shared/errors/app-error.js";
import { toObjectId } from "../../../shared/utils/object-id.js";
import { assertReasonableOccurrence } from "../../../shared/utils/time.js";
import {
  hasPermission,
  PERMISSIONS,
} from "../../admin/permissions.js";
import {
  INCIDENT_TYPES,
  SENSITIVE_INCIDENT_TYPES,
} from "../constants/incident-types.js";
import {
  toAdminIncidentDto,
  toOwnerIncidentDto,
  toPublicIncidentDto,
} from "../dto/incident.dto.js";
import {
  h3CellsForResolutions,
  neighboringCells,
  toGeoJsonPoint,
} from "../../geolocation/h3/h3.js";
import { pointBelongsToBoundary } from "../../geolocation/providers/city-boundary.js";

function duplicateConflict(error, message) {
  if (error instanceof MongoServerError && error.code === 11000) {
    throw conflict(message, "DUPLICATE_INCIDENT_ACTION");
  }
  throw error;
}

function moderationConflict() {
  return conflict(
    "El incidente fue actualizado por otro administrador. Recarga la informacion antes de continuar.",
    "INCIDENT_EDIT_CONFLICT",
  );
}

function sameInstant(date, isoDate) {
  return date?.getTime() === new Date(isoDate).getTime();
}

function activeForeignLock(incident, actorId, now) {
  return (
    incident.reviewLock &&
    incident.reviewLock.expiresAt > now &&
    !incident.reviewLock.lockedBy.equals(actorId)
  );
}

export function createIncidentsService({
  incidentsRepository,
  citiesRepository,
  appSettingsRepository,
  heatmapStatisticsService,
  auditRepository,
  eventBus,
  cache,
  config,
  clock = () => new Date(),
}) {
  async function setting(key, fallback) {
    const cacheKey = `setting:${key}`;
    const cached = cache.get(cacheKey);

    if (cached !== undefined) {
      return cached;
    }

    const value = await appSettingsRepository.getValue(key, fallback);
    cache.set(cacheKey, value, 60_000);
    return value;
  }

  async function activeCity(cityId) {
    const city = await citiesRepository.findActiveById(cityId);
    if (!city) {
      throw notFound("Ciudad");
    }
    return city;
  }

  function locationData({ latitude, longitude }) {
    const location = toGeoJsonPoint({ latitude, longitude });
    const h3Cells = h3CellsForResolutions(
      latitude,
      longitude,
      config.h3SupportedResolutions,
    );

    return {
      location,
      h3Cells,
      h3Index: h3Cells[String(config.h3BaseResolution)],
      h3Resolution: config.h3BaseResolution,
    };
  }

  function assertInsideCity(city, point) {
    if (!city.boundary) {
      throw new AppError({
        code: "CITY_BOUNDARY_UNAVAILABLE",
        message:
          "La ciudad seleccionada no tiene limites geograficos configurados",
        statusCode: 422,
      });
    }

    if (!pointBelongsToBoundary(point, city.boundary)) {
      throw new AppError({
        code: "LOCATION_OUTSIDE_CITY",
        message: "La ubicacion no pertenece a la ciudad seleccionada",
        statusCode: 422,
      });
    }
  }

  async function evaluateCommunity(incidentId) {
    const now = clock();
    const confirmationCount =
      await incidentsRepository.countEligibleConfirmations(incidentId);
    await incidentsRepository.updateConfirmationCount(
      incidentId,
      confirmationCount,
      now,
    );
    const threshold = await setting(
      "incidentConfirmationThreshold",
      config.incidentConfirmationThreshold,
    );

    if (confirmationCount < threshold) {
      const current = await incidentsRepository.findById(incidentId);
      if (current) {
        eventBus.publish("admin.incident.updated", {
          incidentId: current._id.toHexString(),
          status: current.status,
          confirmationCount,
        });
      }
      return current;
    }

    const confirmed = await incidentsRepository.markCommunityConfirmed(
      incidentId,
      confirmationCount,
      now,
    );

    if (confirmed) {
      await heatmapStatisticsService.apply(incidentId);
      const current =
        (await incidentsRepository.findById(incidentId)) ?? confirmed;
      eventBus.publish("incident.community_confirmed", {
        incidentId: current._id.toHexString(),
        cityId: current.cityId.toHexString(),
        incidentType: current.incidentType,
        h3Index: current.h3Index,
        confirmationCount,
      });
      eventBus.publish("admin.incident.updated", {
        incidentId: current._id.toHexString(),
        status: current.status,
        confirmationCount,
      });
      return current;
    }

    const current = await incidentsRepository.findById(incidentId);
    if (current) {
      eventBus.publish("admin.incident.updated", {
        incidentId: current._id.toHexString(),
        status: current.status,
        confirmationCount,
      });
    }
    return current;
  }

  function incidentDocument({
    input,
    user,
    city,
    geo,
    submissionSource,
    status = "pending",
    verificationMethod = "none",
    now,
  }) {
    const verified = status !== "pending";
    const resolvedSubmissionSource =
      submissionSource ??
      (["admin", "superadmin"].includes(user?.role) ? "admin" : "citizen");
    return {
      cityId: city._id,
      incidentType: input.incidentType,
      title: input.title.trim(),
      description: input.description.trim(),
      occurredAt: new Date(input.occurredAt),
      reportedAt: now,
      ...geo,
      locationPrecision: SENSITIVE_INCIDENT_TYPES.has(input.incidentType)
        ? "hexagon"
        : input.locationPrecision ?? "approximate",
      address: input.address?.trim() ?? null,
      neighborhood: input.neighborhood?.trim() ?? null,
      sourceUrls: input.sourceUrl ? [input.sourceUrl] : [],
      evidenceDescription: input.evidenceDescription?.trim() ?? null,
      locationConfirmed: input.confirmLocation ?? null,
      submissionSource: resolvedSubmissionSource,
      status,
      verification: {
        method: verificationMethod,
        confirmationCount: 0,
        verifiedAt: verified ? now : null,
        verifiedBy: verificationMethod === "admin" ? user.id : null,
      },
      createdBy: user?.id ?? null,
      createdByRole: user?.role ?? null,
      statisticsApplied: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      mergedInto: null,
      reviewLock: null,
      version: 0,
    };
  }

  async function createReport(input, user) {
    const now = clock();
    const occurredAt = new Date(input.occurredAt);
    assertReasonableOccurrence(occurredAt, now);
    const city = await activeCity(input.cityId);
    const geo = locationData(input);
    assertInsideCity(city, geo.location);
    const matchWindow = await setting(
      "incidentMatchWindowMinutes",
      config.incidentMatchWindowMinutes,
    );
    const candidate = await incidentsRepository.findCandidate({
      cityId: city._id,
      incidentType: input.incidentType,
      h3Indexes: neighboringCells(geo.h3Index),
      occurredAfter: new Date(occurredAt.getTime() - matchWindow * 60_000),
      occurredBefore: new Date(occurredAt.getTime() + matchWindow * 60_000),
    });

    if (
      candidate &&
      (await incidentsRepository.hasConfirmation(candidate._id, user.id))
    ) {
      throw conflict(
        "Ya reportaste o confirmaste este incidente",
        "INCIDENT_ALREADY_CONFIRMED",
      );
    }

    let incident = candidate;
    if (!incident) {
      incident = await incidentsRepository.createIncident(
        incidentDocument({
          input,
          user,
          city,
          geo,
          now,
        }),
      );
      eventBus.publish("incident.created", {
        incidentId: incident._id.toHexString(),
        cityId: city._id.toHexString(),
        incidentType: incident.incidentType,
        h3Index: incident.h3Index,
        status: incident.status,
      });
      eventBus.publish("admin.incident.pending.created", {
        incidentId: incident._id.toHexString(),
        cityId: city._id.toHexString(),
        incidentType: incident.incidentType,
        status: incident.status,
        createdAt: incident.createdAt.toISOString(),
      });
    }

    let report;
    try {
      report = await incidentsRepository.createReport({
        incidentId: incident._id,
        reporterUserId: user.id,
        incidentType: input.incidentType,
        description: input.description.trim(),
        occurredAt,
        location: geo.location,
        h3Index: geo.h3Index,
        sourceUrl: input.sourceUrl ?? null,
        evidenceDescription: input.evidenceDescription?.trim() ?? null,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
    } catch (error) {
      duplicateConflict(error, "Ya reportaste este incidente");
    }

    try {
      await incidentsRepository.createConfirmation({
        incidentId: incident._id,
        userId: user.id,
        createdAt: now,
      });
    } catch (error) {
      await incidentsRepository.deleteReport(report._id);
      duplicateConflict(error, "Ya reportaste o confirmaste este incidente");
    }

    await incidentsRepository.addSourceUrl(
      incident._id,
      input.sourceUrl,
      now,
    );
    incident = await evaluateCommunity(incident._id);

    return toOwnerIncidentDto(incident);
  }

  async function createAiIncident(input) {
    const now = clock();
    const occurredAt = new Date(input.occurredAt);
    assertReasonableOccurrence(occurredAt, now);
    const city = await activeCity(input.cityId);
    const geo = locationData(input);
    assertInsideCity(city, geo.location);
    if (input.sourceUrl) {
      const existing = await incidentsRepository.findBySourceUrl(input.sourceUrl);
      if (existing) {
        return toAdminIncidentDto(existing);
      }
    }
    const incident = await incidentsRepository.createIncident(
      incidentDocument({
        input,
        user: null,
        city,
        geo,
        submissionSource: "ai_scraper",
        now,
      }),
    );

    eventBus.publish("incident.created", {
      incidentId: incident._id.toHexString(),
      cityId: city._id.toHexString(),
      incidentType: incident.incidentType,
      h3Index: incident.h3Index,
      status: incident.status,
      submissionSource: incident.submissionSource,
    });
    eventBus.publish("admin.incident.pending.created", {
      incidentId: incident._id.toHexString(),
      cityId: city._id.toHexString(),
      incidentType: incident.incidentType,
      status: incident.status,
      submissionSource: incident.submissionSource,
      createdAt: incident.createdAt.toISOString(),
    });

    return toAdminIncidentDto(incident);
  }

  async function list({
    cityId,
    incidentType,
    from,
    to,
    page,
    pageSize,
  }) {
    await activeCity(cityId);
    const filter = { cityId: toObjectId(cityId) };

    if (incidentType) {
      filter.incidentType = incidentType;
    }
    if (from || to) {
      filter.occurredAt = {};
      if (from) {
        filter.occurredAt.$gte = new Date(from);
      }
      if (to) {
        filter.occurredAt.$lte = new Date(to);
      }
    }

    const [incidents, total] = await Promise.all([
      incidentsRepository.listPublic({
        filter,
        skip: (page - 1) * pageSize,
        limit: pageSize,
      }),
      incidentsRepository.countPublic(filter),
    ]);

    return {
      incidents: incidents.map(toPublicIncidentDto),
      total,
    };
  }

  async function get(incidentId) {
    const incident = await incidentsRepository.findPublicById(incidentId);
    if (!incident) {
      throw notFound("Incidente");
    }
    return toPublicIncidentDto(incident);
  }

  async function nearby(input) {
    await activeCity(input.cityId);
    const incidents = await incidentsRepository.nearby({
      cityId: input.cityId,
      point: toGeoJsonPoint(input),
      maxDistance: input.radiusMeters,
      limit: input.limit,
      incidentType: input.incidentType,
    });
    return incidents.map(toPublicIncidentDto);
  }

  async function updateOwned(incidentId, userId, input) {
    const current = await incidentsRepository.findById(incidentId);
    if (!current) {
      throw notFound("Incidente");
    }
    if (current.status !== "pending") {
      throw conflict(
        "Solo se pueden editar incidentes pendientes",
        "INCIDENT_NOT_PENDING",
      );
    }

    const changes = {};
    for (const field of ["title", "description", "address", "neighborhood"]) {
      if (input[field] !== undefined) {
        changes[field] = input[field]?.trim() ?? null;
      }
    }
    if (input.occurredAt) {
      const occurredAt = new Date(input.occurredAt);
      assertReasonableOccurrence(occurredAt, clock());
      changes.occurredAt = occurredAt;
    }
    if (input.latitude !== undefined) {
      const city = await activeCity(current.cityId);
      const geo = locationData(input);
      assertInsideCity(city, geo.location);
      Object.assign(changes, geo);
    }

    const updated = await incidentsRepository.updateOwnedPending(
      incidentId,
      userId,
      changes,
      clock(),
    );
    if (!updated) {
      throw forbidden("Solo el autor puede editar este incidente");
    }

    eventBus.publish("incident.updated", {
      incidentId: updated._id.toHexString(),
      status: updated.status,
    });
    return toOwnerIncidentDto(updated);
  }

  async function deleteOwned(incidentId, userId) {
    const archived = await incidentsRepository.archiveOwnedPending(
      incidentId,
      userId,
      clock(),
    );
    if (!archived) {
      throw forbidden(
        "Solo el autor puede eliminar un incidente pendiente",
      );
    }
  }

  async function confirm(incidentId, userId) {
    const incident = await incidentsRepository.findById(incidentId);
    if (
      !incident ||
      !["pending", "community_confirmed", "admin_verified"].includes(
        incident.status,
      )
    ) {
      throw notFound("Incidente");
    }

    try {
      await incidentsRepository.createConfirmation({
        incidentId: incident._id,
        userId: toObjectId(userId),
        createdAt: clock(),
      });
    } catch (error) {
      duplicateConflict(error, "Ya confirmaste este incidente");
    }

    return toOwnerIncidentDto(await evaluateCommunity(incident._id));
  }

  async function removeConfirmation(incidentId, userId) {
    const removed = await incidentsRepository.deleteConfirmation(
      incidentId,
      userId,
    );
    if (removed.deletedCount === 0) {
      return;
    }

    const now = clock();
    const count =
      await incidentsRepository.countEligibleConfirmations(incidentId);
    await incidentsRepository.updateConfirmationCount(incidentId, count, now);
    const threshold = await setting(
      "incidentConfirmationThreshold",
      config.incidentConfirmationThreshold,
    );
    const incident = await incidentsRepository.findById(incidentId);

    if (incident?.status === "community_confirmed" && count < threshold) {
      const reverted =
        await incidentsRepository.revertCommunityConfirmation(
          incidentId,
          count,
          now,
        );
      if (reverted) {
        await heatmapStatisticsService.remove(incidentId);
        eventBus.publish("incident.updated", {
          incidentId: reverted._id.toHexString(),
          status: reverted.status,
        });
        eventBus.publish("admin.incident.updated", {
          incidentId: reverted._id.toHexString(),
          status: reverted.status,
          confirmationCount: count,
        });
      }
    }
  }

  async function listAdmin({
    page,
    pageSize,
    status,
    cityId,
    incidentType,
    from,
    to,
    minConfirmations,
    source,
    possibleDuplicate,
    sortBy,
    sortOrder,
  }) {
    const filter = { status };
    if (status !== "archived") {
      filter.deletedAt = null;
    }
    if (cityId) {
      await activeCity(cityId);
      filter.cityId = toObjectId(cityId);
    }
    if (incidentType) {
      filter.incidentType = incidentType;
    }
    if (from || to) {
      filter.occurredAt = {};
      if (from) {
        filter.occurredAt.$gte = new Date(from);
      }
      if (to) {
        filter.occurredAt.$lte = new Date(to);
      }
    }
    if (minConfirmations !== undefined) {
      filter["verification.confirmationCount"] = { $gte: minConfirmations };
    }
    if (source === "with") {
      filter["sourceUrls.0"] = { $exists: true };
    } else if (source === "without") {
      filter["sourceUrls.0"] = { $exists: false };
    }

    const result = await incidentsRepository.listAdmin({
      filter,
      skip: (page - 1) * pageSize,
      limit: pageSize,
      sortBy,
      sortOrder,
      possibleDuplicate,
    });
    return {
      incidents: result.incidents.map(toAdminIncidentDto),
      total: result.total,
    };
  }

  async function getAdmin(incidentId, actor) {
    const incident = await incidentsRepository.findAdminById(incidentId);
    if (!incident) {
      throw notFound("Incidente");
    }
    return toAdminIncidentDto(incident, actor);
  }

  async function adminChanges(input, current) {
    const changes = {};
    for (const field of [
      "incidentType",
      "title",
      "description",
      "address",
      "neighborhood",
      "locationPrecision",
    ]) {
      if (input[field] !== undefined) {
        changes[field] =
          typeof input[field] === "string" ? input[field].trim() : input[field];
      }
    }
    if (input.occurredAt) {
      changes.occurredAt = new Date(input.occurredAt);
      assertReasonableOccurrence(changes.occurredAt, clock());
    }
    if (input.latitude !== undefined) {
      const city = await activeCity(current.cityId);
      const geo = locationData(input);
      assertInsideCity(city, geo.location);
      Object.assign(changes, geo);
    }
    return changes;
  }

  function assertCurrentModerationVersion(current, expectedUpdatedAt, actorId) {
    const now = clock();
    if (
      !sameInstant(current.updatedAt, expectedUpdatedAt) ||
      activeForeignLock(current, actorId, now)
    ) {
      throw moderationConflict();
    }
    return now;
  }

  async function claimReviewLock(incidentId, input, actor, requestId) {
    const current = await incidentsRepository.findById(incidentId);
    if (!current) {
      throw notFound("Incidente");
    }
    const now = assertCurrentModerationVersion(
      current,
      input.expectedUpdatedAt,
      actor.id,
    );
    const locked = await incidentsRepository.claimReviewLock({
      incidentId,
      adminId: actor.id,
      expectedUpdatedAt: input.expectedUpdatedAt,
      expiresAt: new Date(now.getTime() + input.ttlSeconds * 1_000),
      now,
    });
    if (!locked) {
      throw moderationConflict();
    }
    await auditRepository.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: "incident.review_lock.claimed",
      resourceType: "incident",
      resourceId: incidentId,
      previousValue: { reviewLock: current.reviewLock ?? null },
      newValue: { reviewLock: locked.reviewLock },
      reason: "Incidente reclamado para revision administrativa",
      metadata: { ttlSeconds: input.ttlSeconds },
      requestId,
      changes: { reviewLock: locked.reviewLock },
      createdAt: now,
    });
    eventBus.publish("admin.incident.locked", {
      incidentId: locked._id.toHexString(),
      lockedBy: actor.id.toHexString(),
      expiresAt: locked.reviewLock.expiresAt.toISOString(),
    });
    return toAdminIncidentDto(locked);
  }

  async function releaseReviewLock(incidentId, input, actor, requestId) {
    const current = await incidentsRepository.findById(incidentId);
    if (!current) {
      throw notFound("Incidente");
    }
    if (!sameInstant(current.updatedAt, input.expectedUpdatedAt)) {
      throw moderationConflict();
    }
    if (!current.reviewLock) {
      return toAdminIncidentDto(current);
    }
    const allowForeignLock = hasPermission(
      actor.role,
      PERMISSIONS.ADMINS_UPDATE,
    );
    if (!allowForeignLock && !current.reviewLock.lockedBy.equals(actor.id)) {
      throw moderationConflict();
    }
    const now = clock();
    const released = await incidentsRepository.releaseReviewLock({
      incidentId,
      adminId: actor.id,
      expectedUpdatedAt: input.expectedUpdatedAt,
      allowForeignLock,
      now,
    });
    if (!released) {
      throw moderationConflict();
    }
    await auditRepository.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: "incident.review_lock.released",
      resourceType: "incident",
      resourceId: incidentId,
      previousValue: { reviewLock: current.reviewLock },
      newValue: { reviewLock: null },
      reason: input.reason ?? "Bloqueo liberado por el revisor",
      metadata: { forced: allowForeignLock && !current.reviewLock.lockedBy.equals(actor.id) },
      requestId,
      changes: { reviewLock: null },
      createdAt: now,
    });
    eventBus.publish("admin.incident.updated", {
      incidentId: released._id.toHexString(),
      reviewLock: null,
    });
    return toAdminIncidentDto(released);
  }

  async function createAdmin(input, admin) {
    const now = clock();
    const occurredAt = new Date(input.occurredAt);
    assertReasonableOccurrence(occurredAt, now);
    const city = await activeCity(input.cityId);
    const geo = locationData(input);
    assertInsideCity(city, geo.location);
    const incident = await incidentsRepository.createIncident(
      incidentDocument({
        input,
        user: admin,
        city,
        geo,
        status: "admin_verified",
        verificationMethod: "admin",
        now,
      }),
    );

    await heatmapStatisticsService.apply(incident._id);
    await auditRepository.record({
      actorId: admin.id,
      action: "incident.created",
      resourceType: "incident",
      resourceId: incident._id,
      changes: { status: "admin_verified" },
      createdAt: now,
    });
    eventBus.publish("incident.admin_verified", {
      incidentId: incident._id.toHexString(),
      cityId: city._id.toHexString(),
      incidentType: incident.incidentType,
      h3Index: incident.h3Index,
    });
    return toAdminIncidentDto(
      await incidentsRepository.findById(incident._id),
    );
  }

  async function updateAdmin(incidentId, input, actor, requestId) {
    const current = await incidentsRepository.findById(incidentId);
    if (!current) {
      throw notFound("Incidente");
    }
    assertCurrentModerationVersion(
      current,
      input.expectedUpdatedAt,
      actor.id,
    );

    const wasCounted = current.statisticsApplied;
    const changes = await adminChanges(input, current);
    const affectsStatistics = [
      "incidentType",
      "occurredAt",
      "location",
      "h3Index",
    ].some((field) => changes[field] !== undefined);
    let effectiveExpectedUpdatedAt = input.expectedUpdatedAt;

    try {
      if (wasCounted && affectsStatistics) {
        await heatmapStatisticsService.remove(incidentId);
        const released = await incidentsRepository.findById(incidentId);
        effectiveExpectedUpdatedAt = released.updatedAt.toISOString();
      }
      const updated = await incidentsRepository.updateAdmin(
        {
          incidentId,
          changes,
          sourceUrls: input.sourceUrls,
          expectedUpdatedAt: effectiveExpectedUpdatedAt,
          actorId: actor.id,
          now: clock(),
        },
      );
      if (!updated) {
        throw moderationConflict();
      }
      if (
        affectsStatistics &&
        ["community_confirmed", "admin_verified"].includes(updated.status)
      ) {
        await heatmapStatisticsService.apply(incidentId);
      }
      const previousValue = Object.fromEntries(
        Object.keys(changes).map((key) => [
          key,
          ["location", "h3Cells"].includes(key) ? "updated" : current[key],
        ]),
      );
      const newValue = Object.fromEntries(
        Object.entries(changes).map(([key, value]) => [
          key,
          ["location", "h3Cells"].includes(key) ? "updated" : value,
        ]),
      );
      if (input.sourceUrls) {
        previousValue.sourceUrls = current.sourceUrls ?? [];
        newValue.sourceUrls = [
          ...new Set([...(current.sourceUrls ?? []), ...input.sourceUrls]),
        ];
      }
      await auditRepository.record({
        actorId: actor.id,
        actorRole: actor.role,
        action: "incident.updated",
        resourceType: "incident",
        resourceId: incidentId,
        previousValue,
        newValue,
        reason: input.reason,
        metadata: { affectsStatistics },
        requestId,
        changes: newValue,
        createdAt: clock(),
      });
      eventBus.publish("admin.incident.updated", {
        incidentId: updated._id.toHexString(),
        status: updated.status,
      });
      eventBus.publish("incident.updated", {
        incidentId: updated._id.toHexString(),
        status: updated.status,
      });
      return toAdminIncidentDto(
        await incidentsRepository.findById(incidentId),
      );
    } catch (error) {
      if (wasCounted && affectsStatistics) {
        await heatmapStatisticsService.apply(incidentId);
      }
      throw error;
    }
  }

  async function approve(incidentId, input, actor, requestId) {
    const current = await incidentsRepository.findById(incidentId);
    if (!current) {
      throw notFound("Incidente");
    }
    assertCurrentModerationVersion(
      current,
      input.expectedUpdatedAt,
      actor.id,
    );
    const changes = await adminChanges(input.corrections, current);
    const affectsStatistics = [
      "incidentType",
      "occurredAt",
      "location",
      "h3Index",
    ].some((field) => changes[field] !== undefined);
    const wasCounted = current.statisticsApplied;
    let effectiveExpectedUpdatedAt = input.expectedUpdatedAt;

    try {
      if (wasCounted && affectsStatistics) {
        await heatmapStatisticsService.remove(incidentId);
        const released = await incidentsRepository.findById(incidentId);
        effectiveExpectedUpdatedAt = released.updatedAt.toISOString();
      }
      const now = clock();
      const incident = await incidentsRepository.approveAdmin({
        incidentId,
        adminId: actor.id,
        changes,
        sourceUrls: input.sourceUrls,
        reason: input.reason,
        expectedUpdatedAt: effectiveExpectedUpdatedAt,
        now,
      });
      if (!incident) {
        throw moderationConflict();
      }
      await heatmapStatisticsService.apply(incidentId);
      await auditRepository.record({
        actorId: actor.id,
        actorRole: actor.role,
        action: "incident.approved",
        resourceType: "incident",
        resourceId: incidentId,
        previousValue: {
          status: current.status,
          verification: current.verification,
        },
        newValue: {
          status: "admin_verified",
          verificationMethod: "admin",
          corrections: Object.keys(changes),
          sourceUrls: input.sourceUrls,
        },
        reason: input.reason,
        metadata: { bypassedCommunityThreshold: current.status === "pending" },
        requestId,
        changes: { status: "admin_verified" },
        createdAt: now,
      });
      eventBus.publish("incident.admin_verified", {
        incidentId: incident._id.toHexString(),
        cityId: incident.cityId.toHexString(),
        incidentType: incident.incidentType,
        h3Index: incident.h3Index,
      });
      eventBus.publish("admin.incident.reviewed", {
        incidentId: incident._id.toHexString(),
        outcome: "approved",
      });
      return toAdminIncidentDto(
        await incidentsRepository.findById(incidentId),
      );
    } catch (error) {
      if (wasCounted && affectsStatistics) {
        await heatmapStatisticsService.apply(incidentId);
      }
      throw error;
    }
  }

  async function reject(incidentId, input, actor, requestId) {
    const current = await incidentsRepository.findById(incidentId);
    if (!current) {
      throw notFound("Incidente");
    }
    assertCurrentModerationVersion(
      current,
      input.expectedUpdatedAt,
      actor.id,
    );
    const now = clock();
    const incident = await incidentsRepository.rejectAdmin({
      incidentId,
      adminId: actor.id,
      reasonCode: input.reasonCode,
      reason: input.reason,
      expectedUpdatedAt: input.expectedUpdatedAt,
      now,
    });
    if (!incident) {
      throw moderationConflict();
    }
    await heatmapStatisticsService.remove(incidentId);
    await auditRepository.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: "incident.rejected",
      resourceType: "incident",
      resourceId: incidentId,
      previousValue: {
        status: current.status,
        verification: current.verification,
      },
      newValue: {
        status: "rejected",
        reasonCode: input.reasonCode,
      },
      reason: input.reason,
      metadata: { statisticsWereApplied: current.statisticsApplied },
      requestId,
      changes: { status: "rejected", reasonCode: input.reasonCode },
      createdAt: now,
    });
    eventBus.publish("incident.rejected", {
      incidentId: incident._id.toHexString(),
      cityId: incident.cityId.toHexString(),
    });
    eventBus.publish("admin.incident.reviewed", {
      incidentId: incident._id.toHexString(),
      outcome: "rejected",
    });
    return toAdminIncidentDto(
      await incidentsRepository.findById(incidentId),
    );
  }

  async function merge(primaryId, input, actor, requestId) {
    const secondaryId = input.secondaryIncidentId;
    if (primaryId === secondaryId) {
      throw conflict(
        "Los incidentes principal y secundario deben ser diferentes",
        "SAME_INCIDENT",
      );
    }

    const [primary, secondary] = await Promise.all([
      incidentsRepository.findById(primaryId),
      incidentsRepository.findById(secondaryId),
    ]);
    if (!primary || !secondary) {
      throw notFound("Incidente");
    }
    assertCurrentModerationVersion(
      primary,
      input.expectedUpdatedAt,
      actor.id,
    );
    assertCurrentModerationVersion(
      secondary,
      input.secondaryExpectedUpdatedAt,
      actor.id,
    );
    if (!primary.cityId.equals(secondary.cityId)) {
      throw conflict(
        "Solo se pueden fusionar incidentes de la misma ciudad",
        "DIFFERENT_CITIES",
      );
    }

    let secondaryExpectedUpdatedAt = input.secondaryExpectedUpdatedAt;
    if (secondary.statisticsApplied) {
      await heatmapStatisticsService.remove(secondaryId);
      const released = await incidentsRepository.findById(secondaryId);
      secondaryExpectedUpdatedAt = released.updatedAt.toISOString();
    }
    const now = clock();
    const primaryClaim = await incidentsRepository.mergeSources({
      primaryId,
      sourceUrls: secondary.sourceUrls ?? [],
      expectedUpdatedAt: input.expectedUpdatedAt,
      actorId: actor.id,
      now,
    });
    if (primaryClaim.modifiedCount !== 1) {
      if (secondary.statisticsApplied) {
        await heatmapStatisticsService.apply(secondaryId);
      }
      throw moderationConflict();
    }
    const archived = await incidentsRepository.markMerged({
      secondaryId,
      primaryId,
      actorId: actor.id,
      reason: input.reason,
      expectedUpdatedAt: secondaryExpectedUpdatedAt,
      now,
    });
    if (!archived) {
      if (secondary.statisticsApplied) {
        await heatmapStatisticsService.apply(secondaryId);
      }
      throw moderationConflict();
    }
    await incidentsRepository.mergeRelatedData(primaryId, secondaryId);
    const updatedPrimary = await evaluateCommunity(primaryId);

    await auditRepository.record({
      actorId: actor.id,
      actorRole: actor.role,
      action: "incident.merged",
      resourceType: "incident",
      resourceId: secondaryId,
      previousValue: {
        primary: { id: primaryId, status: primary.status },
        secondary: { id: secondaryId, status: secondary.status },
      },
      newValue: {
        primaryIncidentId: primaryId,
        secondaryStatus: "archived",
      },
      reason: input.reason,
      metadata: {
        primaryStatisticsApplied: primary.statisticsApplied,
        secondaryStatisticsApplied: secondary.statisticsApplied,
      },
      requestId,
      changes: { mergedInto: primaryId },
      createdAt: now,
    });
    eventBus.publish("incident.merged", {
      incidentId: secondary._id.toHexString(),
      mergedInto: primary._id.toHexString(),
      cityId: primary.cityId.toHexString(),
    });
    eventBus.publish("admin.incident.reviewed", {
      incidentId: secondary._id.toHexString(),
      outcome: "merged",
      mergedInto: primary._id.toHexString(),
    });
    return toAdminIncidentDto(updatedPrimary);
  }

  return Object.freeze({
    getTypes: () => INCIDENT_TYPES,
    createReport,
    createAiIncident,
    list,
    get,
    nearby,
    updateOwned,
    deleteOwned,
    confirm,
    removeConfirmation,
    listAdmin,
    getAdmin,
    claimReviewLock,
    releaseReviewLock,
    createAdmin,
    updateAdmin,
    approve,
    reject,
    merge,
  });
}
