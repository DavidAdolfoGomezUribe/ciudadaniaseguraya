import { toObjectId } from "../../../shared/utils/object-id.js";

const publicProjection = {
  cityId: 1,
  incidentType: 1,
  title: 1,
  description: 1,
  occurredAt: 1,
  reportedAt: 1,
  location: 1,
  locationPrecision: 1,
  address: 1,
  neighborhood: 1,
  h3Index: 1,
  h3Resolution: 1,
  h3Cells: 1,
  sourceUrls: 1,
  evidenceDescription: 1,
  locationConfirmed: 1,
  submissionSource: 1,
  status: 1,
  verification: 1,
  statisticsApplied: 1,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: 1,
  mergedInto: 1,
  createdByRole: 1,
  reviewLock: 1,
  moderation: 1,
  version: 1,
};

const visibleStatuses = ["community_confirmed", "admin_verified"];

function availableReviewFilter(actorId, now) {
  return {
    $or: [
      { reviewLock: { $exists: false } },
      { reviewLock: null },
      { "reviewLock.expiresAt": { $lte: now } },
      { "reviewLock.lockedBy": toObjectId(actorId) },
    ],
  };
}

function possibleDuplicatesLookup() {
  return {
    $lookup: {
      from: "incidents",
      let: {
        currentId: "$_id",
        cityId: "$cityId",
        incidentType: "$incidentType",
        h3Index: "$h3Index",
        occurredAt: "$occurredAt",
      },
      pipeline: [
        {
          $match: {
            $expr: {
              $and: [
                { $ne: ["$_id", "$$currentId"] },
                { $eq: ["$cityId", "$$cityId"] },
                { $eq: ["$incidentType", "$$incidentType"] },
                { $eq: ["$h3Index", "$$h3Index"] },
                {
                  $gte: [
                    "$occurredAt",
                    {
                      $dateSubtract: {
                        startDate: "$$occurredAt",
                        unit: "hour",
                        amount: 3,
                      },
                    },
                  ],
                },
                {
                  $lte: [
                    "$occurredAt",
                    {
                      $dateAdd: {
                        startDate: "$$occurredAt",
                        unit: "hour",
                        amount: 3,
                      },
                    },
                  ],
                },
                { $ne: ["$status", "archived"] },
                { $eq: ["$deletedAt", null] },
              ],
            },
          },
        },
        { $limit: 5 },
        {
          $project: {
            cityId: 1,
            incidentType: 1,
            title: 1,
            occurredAt: 1,
            reportedAt: 1,
            h3Index: 1,
            status: 1,
            updatedAt: 1,
          },
        },
      ],
      as: "possibleDuplicates",
    },
  };
}

export function createIncidentsRepository(db) {
  const incidents = db.collection("incidents");
  const reports = db.collection("incident_reports");
  const confirmations = db.collection("incident_confirmations");

  return Object.freeze({
    async createIncident(document) {
      const result = await incidents.insertOne(document);
      return { _id: result.insertedId, ...document };
    },
    findBySourceUrl(sourceUrl) {
      return incidents.findOne(
        {
          sourceUrls: sourceUrl,
          deletedAt: null,
        },
        { projection: publicProjection },
      );
    },
    async createReport(document) {
      const result = await reports.insertOne(document);
      return { _id: result.insertedId, ...document };
    },
    deleteReport(reportId) {
      return reports.deleteOne({ _id: toObjectId(reportId) });
    },
    addSourceUrl(incidentId, sourceUrl, now) {
      if (!sourceUrl) {
        return Promise.resolve({ modifiedCount: 0 });
      }
      return incidents.updateOne(
        { _id: toObjectId(incidentId) },
        {
          $addToSet: { sourceUrls: sourceUrl },
          $set: { updatedAt: now },
        },
      );
    },
    findCandidate({
      cityId,
      incidentType,
      h3Indexes,
      occurredAfter,
      occurredBefore,
    }) {
      return incidents.findOne(
        {
          cityId: toObjectId(cityId),
          incidentType,
          h3Index: { $in: h3Indexes },
          occurredAt: {
            $gte: occurredAfter,
            $lte: occurredBefore,
          },
          status: {
            $in: ["pending", ...visibleStatuses],
          },
          deletedAt: null,
        },
        {
          projection: publicProjection,
          sort: { occurredAt: -1 },
        },
      );
    },
    async createConfirmation(document) {
      const result = await confirmations.insertOne(document);
      return { _id: result.insertedId, ...document };
    },
    deleteConfirmation(incidentId, userId) {
      return confirmations.deleteOne({
        incidentId: toObjectId(incidentId),
        userId: toObjectId(userId),
      });
    },
    hasConfirmation(incidentId, userId) {
      return confirmations.findOne(
        {
          incidentId: toObjectId(incidentId),
          userId: toObjectId(userId),
        },
        { projection: { _id: 1 } },
      );
    },
    async countEligibleConfirmations(incidentId) {
      const [result] = await confirmations
        .aggregate([
          { $match: { incidentId: toObjectId(incidentId) } },
          {
            $lookup: {
              from: "users",
              localField: "userId",
              foreignField: "_id",
              as: "user",
            },
          },
          { $unwind: "$user" },
          { $match: { "user.status": "active" } },
          { $count: "total" },
        ])
        .toArray();

      return result?.total ?? 0;
    },
    updateConfirmationCount(incidentId, count, now) {
      return incidents.updateOne(
        { _id: toObjectId(incidentId) },
        {
          $set: {
            "verification.confirmationCount": count,
            updatedAt: now,
          },
        },
      );
    },
    markCommunityConfirmed(incidentId, confirmationCount, now) {
      return incidents.findOneAndUpdate(
        {
          _id: toObjectId(incidentId),
          status: "pending",
        },
        {
          $set: {
            status: "community_confirmed",
            verification: {
              method: "community",
              confirmationCount,
              verifiedAt: now,
              verifiedBy: null,
            },
            updatedAt: now,
          },
        },
        {
          projection: publicProjection,
          returnDocument: "after",
        },
      );
    },
    revertCommunityConfirmation(incidentId, confirmationCount, now) {
      return incidents.findOneAndUpdate(
        {
          _id: toObjectId(incidentId),
          status: "community_confirmed",
        },
        {
          $set: {
            status: "pending",
            verification: {
              method: "none",
              confirmationCount,
              verifiedAt: null,
              verifiedBy: null,
            },
            updatedAt: now,
          },
        },
        {
          projection: publicProjection,
          returnDocument: "after",
        },
      );
    },
    claimStatistics(incidentId, now) {
      return incidents.findOneAndUpdate(
        {
          _id: toObjectId(incidentId),
          status: { $in: visibleStatuses },
          statisticsApplied: false,
        },
        {
          $set: {
            statisticsApplied: true,
            updatedAt: now,
          },
        },
        {
          projection: publicProjection,
          returnDocument: "after",
        },
      );
    },
    releaseStatistics(incidentId, now) {
      return incidents.findOneAndUpdate(
        {
          _id: toObjectId(incidentId),
          statisticsApplied: true,
        },
        {
          $set: {
            statisticsApplied: false,
            updatedAt: now,
          },
        },
        {
          projection: publicProjection,
          returnDocument: "after",
        },
      );
    },
    setStatisticsApplied(incidentId, value, now) {
      return incidents.updateOne(
        { _id: toObjectId(incidentId) },
        {
          $set: {
            statisticsApplied: value,
            updatedAt: now,
          },
        },
      );
    },
    updateGeospatialIndexes(
      incidentId,
      { h3Cells, h3Index, h3Resolution },
      now,
    ) {
      return incidents.updateOne(
        { _id: toObjectId(incidentId) },
        {
          $set: {
            h3Cells,
            h3Index,
            h3Resolution,
            updatedAt: now,
          },
        },
      );
    },
    findById(incidentId) {
      return incidents.findOne(
        { _id: toObjectId(incidentId), deletedAt: null },
        { projection: publicProjection },
      );
    },
    async listAdmin({
      filter,
      skip,
      limit,
      sortBy,
      sortOrder,
      possibleDuplicate,
    }) {
      const sortField =
        sortBy === "confirmationCount"
          ? "verification.confirmationCount"
          : sortBy;
      const pipeline = [
        { $match: filter },
        possibleDuplicatesLookup(),
        {
          $set: {
            possibleDuplicate: {
              $gt: [{ $size: "$possibleDuplicates" }, 0],
            },
          },
        },
      ];

      if (possibleDuplicate !== undefined) {
        pipeline.push({ $match: { possibleDuplicate } });
      }

      pipeline.push({
        $facet: {
          data: [
            {
              $sort: {
                [sortField]: sortOrder === "asc" ? 1 : -1,
                _id: sortOrder === "asc" ? 1 : -1,
              },
            },
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: "cities",
                localField: "cityId",
                foreignField: "_id",
                pipeline: [{ $project: { _id: 0, name: 1 } }],
                as: "city",
              },
            },
            {
              $lookup: {
                from: "incident_reports",
                let: { incidentId: "$_id" },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: ["$incidentId", "$$incidentId"] },
                    },
                  },
                  { $count: "total" },
                ],
                as: "reportSummary",
              },
            },
            {
              $set: {
                cityName: { $first: "$city.name" },
                reportCount: {
                  $ifNull: [{ $first: "$reportSummary.total" }, 0],
                },
              },
            },
            {
              $project: {
                city: 0,
                reportSummary: 0,
                possibleDuplicates: 0,
                createdBy: 0,
              },
            },
          ],
          total: [{ $count: "value" }],
        },
      });

      const [result] = await incidents.aggregate(pipeline).toArray();
      return {
        incidents: result?.data ?? [],
        total: result?.total?.[0]?.value ?? 0,
      };
    },
    async findAdminById(incidentId) {
      const [incident] = await incidents
        .aggregate([
          {
            $match: {
              _id: toObjectId(incidentId),
            },
          },
          possibleDuplicatesLookup(),
          {
            $lookup: {
              from: "cities",
              localField: "cityId",
              foreignField: "_id",
              pipeline: [{ $project: { _id: 0, name: 1 } }],
              as: "city",
            },
          },
          {
            $lookup: {
              from: "incident_reports",
              let: { incidentId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: { $eq: ["$incidentId", "$$incidentId"] },
                  },
                },
                {
                  $project: {
                    reporterUserId: 0,
                    location: 0,
                  },
                },
                { $sort: { createdAt: 1, _id: 1 } },
              ],
              as: "reports",
            },
          },
          {
            $lookup: {
              from: "users",
              localField: "reviewLock.lockedBy",
              foreignField: "_id",
              pipeline: [
                {
                  $project: {
                    username: 1,
                    displayName: 1,
                  },
                },
              ],
              as: "reviewLockReviewers",
            },
          },
          {
            $lookup: {
              from: "audit_logs",
              let: { incidentId: "$_id" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$resourceType", "incident"] },
                        { $eq: ["$resourceId", "$$incidentId"] },
                      ],
                    },
                  },
                },
                {
                  $project: {
                    action: 1,
                    actorId: 1,
                    actorUserId: 1,
                    actorRole: 1,
                    previousValue: 1,
                    newValue: 1,
                    changes: 1,
                    reason: 1,
                    requestId: 1,
                    createdAt: 1,
                  },
                },
                { $sort: { createdAt: -1, _id: -1 } },
                { $limit: 100 },
              ],
              as: "history",
            },
          },
          {
            $set: {
              cityName: { $first: "$city.name" },
              reviewLockReviewer: {
                $first: "$reviewLockReviewers",
              },
              reportCount: { $size: "$reports" },
              confirmationCount: "$verification.confirmationCount",
            },
          },
          {
            $project: {
              city: 0,
              reviewLockReviewers: 0,
              createdBy: 0,
            },
          },
        ])
        .toArray();

      return incident ?? null;
    },
    findPublicById(incidentId) {
      return incidents.findOne(
        {
          _id: toObjectId(incidentId),
          status: { $in: visibleStatuses },
          deletedAt: null,
        },
        { projection: publicProjection },
      );
    },
    async listPublic({ filter, skip, limit }) {
      return incidents
        .find(
          {
            ...filter,
            status: { $in: visibleStatuses },
            deletedAt: null,
          },
          { projection: publicProjection },
        )
        .sort({ occurredAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
    },
    countPublic(filter) {
      return incidents.countDocuments({
        ...filter,
        status: { $in: visibleStatuses },
        deletedAt: null,
      });
    },
    async nearby({ cityId, point, maxDistance, limit, incidentType }) {
      const filter = {
        cityId: toObjectId(cityId),
        status: { $in: visibleStatuses },
        deletedAt: null,
        location: {
          $near: {
            $geometry: point,
            $maxDistance: maxDistance,
          },
        },
      };
      if (incidentType) {
        filter.incidentType = incidentType;
      }

      return incidents
        .find(filter, { projection: publicProjection })
        .limit(limit)
        .toArray();
    },
    updateOwnedPending(incidentId, userId, changes, now) {
      return incidents.findOneAndUpdate(
        {
          _id: toObjectId(incidentId),
          createdBy: toObjectId(userId),
          createdByRole: "user",
          status: "pending",
          deletedAt: null,
        },
        {
          $set: {
            ...changes,
            updatedAt: now,
          },
        },
        {
          projection: publicProjection,
          returnDocument: "after",
        },
      );
    },
    archiveOwnedPending(incidentId, userId, now) {
      return incidents.findOneAndUpdate(
        {
          _id: toObjectId(incidentId),
          createdBy: toObjectId(userId),
          createdByRole: "user",
          status: "pending",
          deletedAt: null,
        },
        {
          $set: {
            status: "archived",
            deletedAt: now,
            updatedAt: now,
          },
        },
        { returnDocument: "after" },
      );
    },
    updateAdmin({
      incidentId,
      changes,
      sourceUrls,
      expectedUpdatedAt,
      actorId,
      now,
    }) {
      const update = {
        $set: {
          ...changes,
          updatedAt: now,
        },
        $inc: { version: 1 },
      };
      if (sourceUrls?.length) {
        update.$addToSet = { sourceUrls: { $each: sourceUrls } };
      }
      return incidents.findOneAndUpdate(
        {
          _id: toObjectId(incidentId),
          status: { $ne: "archived" },
          deletedAt: null,
          updatedAt: new Date(expectedUpdatedAt),
          ...availableReviewFilter(actorId, now),
        },
        update,
        {
          projection: publicProjection,
          returnDocument: "after",
        },
      );
    },
    approveAdmin({
      incidentId,
      adminId,
      changes,
      sourceUrls,
      reason,
      expectedUpdatedAt,
      now,
    }) {
      const update = {
        $set: {
          ...changes,
          status: "admin_verified",
          "verification.method": "admin",
          "verification.verifiedAt": now,
          "verification.verifiedBy": toObjectId(adminId),
          "moderation.lastAction": "approved",
          "moderation.lastReason": reason,
          "moderation.lastActorId": toObjectId(adminId),
          "moderation.lastActionAt": now,
          updatedAt: now,
        },
        $unset: { reviewLock: "" },
        $inc: { version: 1 },
      };
      if (sourceUrls?.length) {
        update.$addToSet = { sourceUrls: { $each: sourceUrls } };
      }
      return incidents.findOneAndUpdate(
        {
          _id: toObjectId(incidentId),
          status: { $in: ["pending", "community_confirmed"] },
          deletedAt: null,
          updatedAt: new Date(expectedUpdatedAt),
          ...availableReviewFilter(adminId, now),
        },
        update,
        {
          projection: publicProjection,
          returnDocument: "after",
        },
      );
    },
    rejectAdmin({
      incidentId,
      adminId,
      reasonCode,
      reason,
      expectedUpdatedAt,
      now,
    }) {
      return incidents.findOneAndUpdate(
        {
          _id: toObjectId(incidentId),
          status: { $in: ["pending", ...visibleStatuses] },
          deletedAt: null,
          updatedAt: new Date(expectedUpdatedAt),
          ...availableReviewFilter(adminId, now),
        },
        {
          $set: {
            status: "rejected",
            "verification.method": "none",
            "verification.verifiedAt": null,
            "verification.verifiedBy": null,
            "moderation.lastAction": "rejected",
            "moderation.lastReasonCode": reasonCode,
            "moderation.lastReason": reason,
            "moderation.lastActorId": toObjectId(adminId),
            "moderation.lastActionAt": now,
            updatedAt: now,
          },
          $unset: { reviewLock: "" },
          $inc: { version: 1 },
        },
        {
          projection: publicProjection,
          returnDocument: "after",
        },
      );
    },
    claimReviewLock({
      incidentId,
      adminId,
      expectedUpdatedAt,
      expiresAt,
      now,
    }) {
      return incidents.findOneAndUpdate(
        {
          _id: toObjectId(incidentId),
          status: { $ne: "archived" },
          deletedAt: null,
          updatedAt: new Date(expectedUpdatedAt),
          ...availableReviewFilter(adminId, now),
        },
        {
          $set: {
            reviewLock: {
              lockedBy: toObjectId(adminId),
              lockedAt: now,
              expiresAt,
            },
            updatedAt: now,
          },
          $inc: { version: 1 },
        },
        {
          projection: publicProjection,
          returnDocument: "after",
        },
      );
    },
    releaseReviewLock({
      incidentId,
      adminId,
      expectedUpdatedAt,
      allowForeignLock,
      now,
    }) {
      return incidents.findOneAndUpdate(
        {
          _id: toObjectId(incidentId),
          deletedAt: null,
          updatedAt: new Date(expectedUpdatedAt),
          ...(allowForeignLock
            ? { reviewLock: { $type: "object" } }
            : { "reviewLock.lockedBy": toObjectId(adminId) }),
        },
        {
          $unset: { reviewLock: "" },
          $set: { updatedAt: now },
          $inc: { version: 1 },
        },
        {
          projection: publicProjection,
          returnDocument: "after",
        },
      );
    },
    async mergeRelatedData(primaryId, secondaryId) {
      const primaryObjectId = toObjectId(primaryId);
      const secondaryObjectId = toObjectId(secondaryId);
      const [reporters, users] = await Promise.all([
        reports.distinct("reporterUserId", { incidentId: primaryObjectId }),
        confirmations.distinct("userId", { incidentId: primaryObjectId }),
      ]);

      await Promise.all([
        reports.deleteMany({
          incidentId: secondaryObjectId,
          reporterUserId: { $in: reporters },
        }),
        confirmations.deleteMany({
          incidentId: secondaryObjectId,
          userId: { $in: users },
        }),
      ]);

      await Promise.all([
        reports.updateMany(
          { incidentId: secondaryObjectId },
          { $set: { incidentId: primaryObjectId, status: "merged" } },
        ),
        confirmations.updateMany(
          { incidentId: secondaryObjectId },
          { $set: { incidentId: primaryObjectId } },
        ),
      ]);
    },
    markMerged({
      secondaryId,
      primaryId,
      actorId,
      reason,
      expectedUpdatedAt,
      now,
    }) {
      return incidents.findOneAndUpdate(
        {
          _id: toObjectId(secondaryId),
          status: { $ne: "archived" },
          deletedAt: null,
          updatedAt: new Date(expectedUpdatedAt),
          ...availableReviewFilter(actorId, now),
        },
        {
          $set: {
            status: "archived",
            mergedInto: toObjectId(primaryId),
            deletedAt: now,
            "moderation.lastAction": "merged",
            "moderation.lastReason": reason,
            "moderation.lastActorId": toObjectId(actorId),
            "moderation.lastActionAt": now,
            updatedAt: now,
          },
          $unset: { reviewLock: "" },
          $inc: { version: 1 },
        },
        {
          projection: publicProjection,
          returnDocument: "after",
        },
      );
    },
    mergeSources({
      primaryId,
      sourceUrls,
      expectedUpdatedAt,
      actorId,
      now,
    }) {
      return incidents.updateOne(
        {
          _id: toObjectId(primaryId),
          deletedAt: null,
          updatedAt: new Date(expectedUpdatedAt),
          ...availableReviewFilter(actorId, now),
        },
        {
          $addToSet: { sourceUrls: { $each: sourceUrls } },
          $set: { updatedAt: now },
          $inc: { version: 1 },
        },
      );
    },
    async listPublicByH3({
      cityId,
      h3Index,
      resolution,
      month,
      from,
      to,
      timezone,
      limit,
    }) {
      const temporalFilter = month
        ? {
            $expr: {
              $eq: [
                {
                  $dateToString: {
                    date: "$occurredAt",
                    format: "%Y-%m",
                    timezone,
                  },
                },
                month,
              ],
            },
          }
        : {
            occurredAt: {
              $gte: from,
              $lte: to,
            },
          };

      return incidents
        .find(
          {
            cityId: toObjectId(cityId),
            [`h3Cells.${resolution}`]: h3Index,
            status: { $in: visibleStatuses },
            deletedAt: null,
            ...temporalFilter,
          },
          { projection: publicProjection },
        )
        .sort({ occurredAt: -1, _id: -1 })
        .limit(limit)
        .toArray();
    },
  });
}
