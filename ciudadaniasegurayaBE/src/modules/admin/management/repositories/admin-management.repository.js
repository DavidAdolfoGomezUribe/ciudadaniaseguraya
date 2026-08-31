import { toObjectId } from "../../../../shared/utils/object-id.js";

const userProjection = {
  passwordHash: 0,
  googleSubject: 0,
};

const editableSettingKeys = [
  "incidentConfirmationThreshold",
  "incidentMatchWindowMinutes",
];

function escapedSearch(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function serializeUserActivityPipeline() {
  return [
    {
      $lookup: {
        from: "incidents",
        localField: "_id",
        foreignField: "createdBy",
        as: "_incidents",
      },
    },
    {
      $lookup: {
        from: "posts",
        localField: "_id",
        foreignField: "authorId",
        as: "_posts",
      },
    },
    {
      $lookup: {
        from: "comments",
        localField: "_id",
        foreignField: "authorId",
        as: "_comments",
      },
    },
    {
      $lookup: {
        from: "admin_role_requests",
        let: { candidateId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ["$candidateUserId", "$$candidateId"] },
            },
          },
          { $sort: { createdAt: -1 } },
          { $limit: 1 },
          { $project: { status: 1 } },
        ],
        as: "_adminRequest",
      },
    },
    {
      $addFields: {
        incidentCount: { $size: "$_incidents" },
        postCount: { $size: "$_posts" },
        commentCount: { $size: "$_comments" },
        adminRequestStatus: {
          $ifNull: [{ $first: "$_adminRequest.status" }, null],
        },
      },
    },
    {
      $project: {
        passwordHash: 0,
        googleSubject: 0,
        _incidents: 0,
        _posts: 0,
        _comments: 0,
        _adminRequest: 0,
      },
    },
  ];
}

export function createAdminManagementRepository(db) {
  const users = db.collection("users");
  const refreshTokens = db.collection("refresh_tokens");
  const adminRefreshTokens = db.collection("admin_refresh_tokens");
  const requests = db.collection("admin_role_requests");
  const incidents = db.collection("incidents");
  const posts = db.collection("posts");
  const comments = db.collection("comments");
  const auditLogs = db.collection("audit_logs");
  const settings = db.collection("app_settings");

  return Object.freeze({
    findUser(userId) {
      return users.findOne(
        { _id: toObjectId(userId) },
        { projection: userProjection },
      );
    },

    findUserByNormalizedUsername(normalizedUsername) {
      return users.findOne(
        { normalizedUsername },
        { projection: { _id: 1 } },
      );
    },

    async listUsers({
      page,
      pageSize,
      search,
      status,
      sortBy,
      sortOrder,
    }) {
      const filter = { role: "user" };
      if (status) filter.status = status;
      if (search) {
        const expression = new RegExp(escapedSearch(search), "i");
        filter.$or = [
          { username: expression },
          { displayName: expression },
          { email: expression },
        ];
      }

      const sort = {
        [sortBy]: sortOrder === "asc" ? 1 : -1,
        _id: sortOrder === "asc" ? 1 : -1,
      };
      const [items, total] = await Promise.all([
        users
          .aggregate([
            { $match: filter },
            { $sort: sort },
            { $skip: (page - 1) * pageSize },
            { $limit: pageSize },
            ...serializeUserActivityPipeline(),
          ])
          .toArray(),
        users.countDocuments(filter),
      ]);

      return { items, total };
    },

    async listAdministrators({
      page,
      pageSize,
      search,
      status,
      includeEmailSearch = false,
    }) {
      const filter = { role: { $in: ["admin", "superadmin"] } };
      if (status) filter.status = status;
      if (search) {
        const expression = new RegExp(escapedSearch(search), "i");
        filter.$or = [
          { username: expression },
          { displayName: expression },
          ...(includeEmailSearch ? [{ email: expression }] : []),
        ];
      }
      const [items, total] = await Promise.all([
        users
          .find(filter, { projection: userProjection })
          .sort({ role: -1, "adminMetadata.promotedAt": -1, _id: -1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .toArray(),
        users.countDocuments(filter),
      ]);
      return { items, total };
    },

    updateNormalUser(userId, changes, now) {
      return users.findOneAndUpdate(
        {
          _id: toObjectId(userId),
          role: "user",
          status: { $ne: "deleted" },
        },
        { $set: { ...changes, updatedAt: now } },
        {
          projection: userProjection,
          returnDocument: "after",
        },
      );
    },

    updateNormalUserStatus(userId, status, reason, now) {
      return users.findOneAndUpdate(
        {
          _id: toObjectId(userId),
          role: "user",
          status: { $ne: "deleted" },
        },
        {
          $set: {
            status,
            "adminMetadata.suspensionReason":
              status === "suspended" ? reason : null,
            updatedAt: now,
          },
        },
        {
          projection: userProjection,
          returnDocument: "after",
        },
      );
    },

    deleteNormalUser(userId, anonymous, reason, actorId, now) {
      return users.findOneAndUpdate(
        {
          _id: toObjectId(userId),
          role: "user",
          status: { $ne: "deleted" },
        },
        {
          $set: {
            ...anonymous,
            status: "deleted",
            emailVerified: false,
            deletedAt: now,
            updatedAt: now,
            "adminMetadata.deletedBy": toObjectId(actorId),
            "adminMetadata.deletionReason": reason,
          },
          $unset: {
            googleSubject: "",
          },
        },
        {
          projection: userProjection,
          returnDocument: "after",
        },
      );
    },

    promoteUser(userId, actorId, reason, now, roleRequestId = null) {
      return users.findOneAndUpdate(
        {
          _id: toObjectId(userId),
          role: "user",
          status: "active",
        },
        {
          $set: {
            role: "admin",
            adminMetadata: {
              promotedAt: now,
              promotedBy: toObjectId(actorId),
              promotionReason: reason,
              promotionRequestId: roleRequestId
                ? toObjectId(roleRequestId)
                : null,
              isBootstrapSuperadmin: false,
            },
            updatedAt: now,
          },
        },
        {
          projection: userProjection,
          returnDocument: "after",
        },
      );
    },

    rollbackRoleRequestPromotion(userId, roleRequestId, now) {
      return users.findOneAndUpdate(
        {
          _id: toObjectId(userId),
          role: "admin",
          "adminMetadata.promotionRequestId": toObjectId(roleRequestId),
        },
        {
          $set: {
            role: "user",
            updatedAt: now,
          },
          $unset: { adminMetadata: "" },
        },
        {
          projection: userProjection,
          returnDocument: "after",
        },
      );
    },

    rollbackDirectPromotion(userId, actorId, promotedAt, now) {
      return users.findOneAndUpdate(
        {
          _id: toObjectId(userId),
          role: "admin",
          "adminMetadata.promotedBy": toObjectId(actorId),
          "adminMetadata.promotedAt": promotedAt,
          "adminMetadata.promotionRequestId": null,
        },
        {
          $set: {
            role: "user",
            updatedAt: now,
          },
          $unset: { adminMetadata: "" },
        },
        {
          projection: userProjection,
          returnDocument: "after",
        },
      );
    },

    completeRoleRequestPromotionEffects(userId, roleRequestId, now) {
      return users.findOneAndUpdate(
        {
          _id: toObjectId(userId),
          role: "admin",
          "adminMetadata.promotionRequestId": toObjectId(roleRequestId),
          "adminMetadata.promotionEffectsCompletedAt": null,
        },
        {
          $set: {
            "adminMetadata.promotionEffectsCompletedAt": now,
            updatedAt: now,
          },
        },
        {
          projection: userProjection,
          returnDocument: "after",
        },
      );
    },

    demoteAdministrator(adminId, actorId, reason, now) {
      return users.findOneAndUpdate(
        {
          _id: toObjectId(adminId),
          role: "admin",
          "adminMetadata.isBootstrapSuperadmin": { $ne: true },
        },
        {
          $set: {
            role: "user",
            "adminMetadata.demotedAt": now,
            "adminMetadata.demotedBy": toObjectId(actorId),
            "adminMetadata.demotionReason": reason,
            updatedAt: now,
          },
        },
        {
          projection: userProjection,
          returnDocument: "after",
        },
      );
    },

    updateAdministratorStatus(adminId, status, reason, now) {
      return users.findOneAndUpdate(
        {
          _id: toObjectId(adminId),
          role: "admin",
          "adminMetadata.isBootstrapSuperadmin": { $ne: true },
        },
        {
          $set: {
            status,
            "adminMetadata.suspensionReason":
              status === "suspended" ? reason : null,
            updatedAt: now,
          },
        },
        {
          projection: userProjection,
          returnDocument: "after",
        },
      );
    },

    revokeSessions(userId, now, sessionType) {
      const filter = {
        userId: toObjectId(userId),
        revokedAt: null,
      };
      const collection =
        sessionType === "admin" ? adminRefreshTokens : refreshTokens;
      return collection.updateMany(filter, {
        $set: {
          revokedAt: now,
          replacedByTokenHash: null,
        },
      });
    },

    markContentFromDeletedAuthor(userId, now) {
      const authorId = toObjectId(userId);
      return Promise.all([
        posts.updateMany(
          { authorId, status: { $ne: "deleted" } },
          { $set: { status: "deleted", deletedAt: now, updatedAt: now } },
        ),
        comments.updateMany(
          { authorId, status: { $ne: "deleted" } },
          { $set: { status: "deleted", deletedAt: now, updatedAt: now } },
        ),
      ]);
    },

    createRoleRequest(document) {
      return requests.insertOne(document);
    },

    findPendingRoleRequestForCandidate(candidateUserId) {
      return requests.findOne({
        candidateUserId: toObjectId(candidateUserId),
        status: "pending",
      });
    },

    findRoleRequest(requestId) {
      return requests.findOne({ _id: toObjectId(requestId) });
    },

    async listOwnRoleRequests(
      userId,
      { page, pageSize, status, sortOrder },
    ) {
      const actorId = toObjectId(userId);
      const filter = {
        $or: [
          { candidateUserId: actorId },
          { requestedByUserId: actorId },
        ],
      };
      if (status) filter.status = status;
      const [items, total] = await Promise.all([
        requests
          .find(filter)
          .sort({
            createdAt: sortOrder === "asc" ? 1 : -1,
            _id: sortOrder === "asc" ? 1 : -1,
          })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .toArray(),
        requests.countDocuments(filter),
      ]);
      return { items, total };
    },

    async listRoleRequests({ page, pageSize, status, sortOrder }) {
      const filter = {};
      if (status) filter.status = status;
      const [items, total] = await Promise.all([
        requests
          .find(filter)
          .sort({ createdAt: sortOrder === "desc" ? -1 : 1, _id: 1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .toArray(),
        requests.countDocuments(filter),
      ]);
      return { items, total };
    },

    cancelRoleRequest(requestId, actorId, now) {
      const requesterId = toObjectId(actorId);
      return requests.findOneAndUpdate(
        {
          _id: toObjectId(requestId),
          status: "pending",
          $or: [
            { candidateUserId: requesterId },
            { requestedByUserId: requesterId },
          ],
        },
        {
          $set: {
            status: "cancelled",
            updatedAt: now,
          },
        },
        { returnDocument: "after" },
      );
    },

    resolveRoleRequest(requestId, status, actorId, reason, now) {
      return requests.findOneAndUpdate(
        {
          _id: toObjectId(requestId),
          status: "pending",
        },
        {
          $set: {
            status,
            reviewedBy: toObjectId(actorId),
            reviewedAt: now,
            resolutionReason: reason,
            updatedAt: now,
          },
        },
        { returnDocument: "after" },
      );
    },

    completeRoleRequestResolutionEffects(requestId, now) {
      return requests.findOneAndUpdate(
        {
          _id: toObjectId(requestId),
          status: "approved",
          resolutionEffectsCompletedAt: null,
        },
        {
          $set: {
            resolutionEffectsCompletedAt: now,
            updatedAt: now,
          },
        },
        { returnDocument: "after" },
      );
    },

    requestRoleInformation(requestId, actorId, reason, now) {
      return requests.findOneAndUpdate(
        {
          _id: toObjectId(requestId),
          status: "pending",
        },
        {
          $push: {
            informationRequests: {
              requestedBy: toObjectId(actorId),
              requestedAt: now,
              message: reason,
            },
          },
          $set: { updatedAt: now },
        },
        { returnDocument: "after" },
      );
    },

    restoreRoleRequest(requestId, actorId, now) {
      return requests.updateOne(
        {
          _id: toObjectId(requestId),
          status: "approved",
          reviewedBy: toObjectId(actorId),
        },
        {
          $set: {
            status: "pending",
            reviewedBy: null,
            reviewedAt: null,
            resolutionReason: null,
            updatedAt: now,
          },
        },
      );
    },

    async dashboard(auditFilter = {}) {
      const startOfToday = new Date();
      startOfToday.setUTCHours(0, 0, 0, 0);
      const [
        pendingIncidents,
        approvedToday,
        rejectedToday,
        activeUsers,
        suspendedUsers,
        activeAdministrators,
        pendingRequests,
        hiddenComments,
        hiddenPosts,
        oldestPending,
        recentAudit,
      ] = await Promise.all([
        incidents.countDocuments({ status: "pending" }),
        incidents.countDocuments({
          status: "admin_verified",
          "verification.verifiedAt": { $gte: startOfToday },
        }),
        incidents.countDocuments({
          status: "rejected",
          updatedAt: { $gte: startOfToday },
        }),
        users.countDocuments({ role: "user", status: "active" }),
        users.countDocuments({ role: "user", status: "suspended" }),
        users.countDocuments({
          role: { $in: ["admin", "superadmin"] },
          status: "active",
        }),
        requests.countDocuments({ status: "pending" }),
        comments.countDocuments({ status: "hidden" }),
        posts.countDocuments({ status: "hidden" }),
        incidents
          .find(
            { status: "pending" },
            {
              projection: {
                title: 1,
                incidentType: 1,
                cityId: 1,
                createdAt: 1,
              },
            },
          )
          .sort({ createdAt: 1, _id: 1 })
          .limit(5)
          .toArray(),
        auditLogs
          .find(
            auditFilter,
            {
              projection: {
                actorId: 1,
                actorRole: 1,
                action: 1,
                resourceType: 1,
                resourceId: 1,
                reason: 1,
                requestId: 1,
                createdAt: 1,
              },
            },
          )
          .sort({ createdAt: -1, _id: -1 })
          .limit(10)
          .toArray(),
      ]);

      return {
        counts: {
          pendingIncidents,
          approvedToday,
          rejectedToday,
          activeUsers,
          suspendedUsers,
          activeAdministrators,
          pendingRequests,
          reportedComments: hiddenComments,
          pendingPosts: hiddenPosts,
        },
        oldestPending,
        recentAudit,
      };
    },

    listSettings() {
      return settings
        .find(
          { key: { $in: editableSettingKeys } },
          {
            projection: {
              key: 1,
              value: 1,
              updatedAt: 1,
            },
          },
        )
        .sort({ key: 1 })
        .toArray();
    },

    updateSetting(key, value, now) {
      return settings.findOneAndUpdate(
        { key },
        {
          $set: { value, updatedAt: now },
          $setOnInsert: { key, createdAt: now },
        },
        { upsert: true, returnDocument: "after" },
      );
    },
  });
}
