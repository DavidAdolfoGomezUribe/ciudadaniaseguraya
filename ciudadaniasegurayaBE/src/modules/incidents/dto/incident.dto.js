import { SENSITIVE_INCIDENT_TYPES } from "../constants/incident-types.js";
import {
  hasPermission,
  PERMISSIONS,
} from "../../admin/permissions.js";

const publicStatuses = new Set([
  "community_confirmed",
  "admin_verified",
]);

function resolveSubmissionSource(incident) {
  if (incident.submissionSource) {
    return incident.submissionSource;
  }
  return ["admin", "superadmin"].includes(incident.createdByRole)
    ? "admin"
    : "citizen";
}

export function toPublicIncidentDto(incident) {
  const hideExactLocation =
    SENSITIVE_INCIDENT_TYPES.has(incident.incidentType) ||
    incident.locationPrecision === "hexagon";

  return {
    id: incident._id.toHexString(),
    cityId: incident.cityId.toHexString(),
    incidentType: incident.incidentType,
    title: incident.title,
    description: incident.description,
    occurredAt: incident.occurredAt.toISOString(),
    reportedAt: incident.reportedAt.toISOString(),
    location: hideExactLocation ? null : incident.location,
    locationPrecision: hideExactLocation
      ? "hexagon"
      : incident.locationPrecision,
    address: hideExactLocation ? null : incident.address ?? null,
    neighborhood: incident.neighborhood ?? null,
    h3Index: incident.h3Index,
    h3Resolution: incident.h3Resolution,
    sourceUrls: incident.sourceUrls ?? [],
    status: incident.status,
    verification: {
      method: incident.verification.method,
      confirmationCount: incident.verification.confirmationCount,
      verifiedAt: incident.verification.verifiedAt?.toISOString() ?? null,
    },
    createdAt: incident.createdAt.toISOString(),
    updatedAt: incident.updatedAt.toISOString(),
  };
}

export function toOwnerIncidentDto(incident) {
  return {
    ...toPublicIncidentDto(incident),
    isPublic: publicStatuses.has(incident.status),
  };
}

export function toAdminIncidentDto(incident, actor) {
  const actorCanForceRelease = actor
    ? hasPermission(actor.role, PERMISSIONS.ADMINS_UPDATE)
    : false;
  const reviewLock = incident.reviewLock
    ? {
        lockedBy: incident.reviewLock.lockedBy.toHexString(),
        reviewer: incident.reviewLockReviewer
          ? {
              id: incident.reviewLockReviewer._id.toHexString(),
              username: incident.reviewLockReviewer.username,
              displayName:
                incident.reviewLockReviewer.displayName ??
                incident.reviewLockReviewer.username,
            }
          : null,
        lockedAt: incident.reviewLock.lockedAt.toISOString(),
        expiresAt: incident.reviewLock.expiresAt.toISOString(),
        canRelease:
          Boolean(actor) &&
          (incident.reviewLock.lockedBy.equals(actor.id) ||
            actorCanForceRelease),
      }
    : null;

  const submissionSource = resolveSubmissionSource(incident);

  return {
    ...toPublicIncidentDto(incident),
    cityName: incident.cityName ?? null,
    reportCount: incident.reportCount ?? 0,
    possibleDuplicate:
      incident.possibleDuplicate ?? (incident.possibleDuplicates?.length > 0),
    submissionSource,
    evidenceDescription: incident.evidenceDescription ?? null,
    locationConfirmed: incident.locationConfirmed ?? null,
    reporter: {
      anonymous: true,
      source:
        submissionSource === "ai_scraper"
          ? "ai_scraper"
          : (incident.createdByRole ?? "user"),
    },
    reviewLock,
    version: incident.version ?? 0,
    statisticsApplied: incident.statisticsApplied,
    deletedAt: incident.deletedAt?.toISOString() ?? null,
    mergedInto: incident.mergedInto?.toHexString() ?? null,
    moderation: incident.moderation
      ? {
          ...incident.moderation,
          lastActorId:
            incident.moderation.lastActorId?.toHexString?.() ??
            incident.moderation.lastActorId ??
            null,
          lastActionAt:
            incident.moderation.lastActionAt?.toISOString?.() ??
            incident.moderation.lastActionAt ??
            null,
        }
      : null,
    ...(incident.reports
      ? {
          reports: incident.reports.map((report) => ({
            id: report._id.toHexString(),
            incidentType: report.incidentType,
            description: report.description,
            occurredAt: report.occurredAt.toISOString(),
            sourceUrl: report.sourceUrl ?? null,
            evidenceDescription: report.evidenceDescription ?? null,
            status: report.status,
            createdAt: report.createdAt.toISOString(),
            reporter: { anonymous: true },
          })),
        }
      : {}),
    ...(incident.possibleDuplicates
      ? {
          possibleDuplicates: incident.possibleDuplicates.map((candidate) => ({
            id: candidate._id.toHexString(),
            cityId: candidate.cityId.toHexString(),
            incidentType: candidate.incidentType,
            title: candidate.title,
            occurredAt: candidate.occurredAt.toISOString(),
            reportedAt: candidate.reportedAt.toISOString(),
            h3Index: candidate.h3Index,
            status: candidate.status,
            updatedAt: candidate.updatedAt.toISOString(),
          })),
        }
      : {}),
    ...(incident.history
      ? {
          history: incident.history.map((entry) => ({
            id: entry._id.toHexString(),
            action: entry.action,
            actorId:
              entry.actorUserId?.toHexString?.() ??
              entry.actorId?.toHexString?.() ??
              null,
            actorRole: entry.actorRole ?? null,
            previousValue: entry.previousValue ?? null,
            newValue: entry.newValue ?? entry.changes ?? null,
            reason: entry.reason ?? null,
            requestId: entry.requestId ?? null,
            createdAt: entry.createdAt.toISOString(),
          })),
        }
      : {}),
  };
}
