import { toObjectId } from "../../../../shared/utils/object-id.js";

const sessionProjection = {
  userId: 1,
  sessionId: 1,
  tokenHash: 1,
  expiresAt: 1,
  createdAt: 1,
  revokedAt: 1,
  replacedByTokenHash: 1,
  ipAddress: 1,
  userAgent: 1,
};

export function createAdminSessionRepository(db) {
  const collection = db.collection("admin_refresh_tokens");

  return Object.freeze({
    create(document) {
      return collection.insertOne(document);
    },
    findByTokenHash(tokenHash) {
      return collection.findOne({ tokenHash }, { projection: sessionProjection });
    },
    findUsable(tokenHash, now) {
      return collection.findOne(
        {
          tokenHash,
          revokedAt: null,
          expiresAt: { $gt: now },
        },
        { projection: sessionProjection },
      );
    },
    findActiveSession(sessionId, userId, now) {
      return collection.findOne(
        {
          sessionId,
          userId: toObjectId(userId),
          revokedAt: null,
          expiresAt: { $gt: now },
        },
        {
          projection: {
            _id: 1,
            sessionId: 1,
          },
        },
      );
    },
    rotate(tokenHash, replacedByTokenHash, now) {
      return collection.updateOne(
        {
          tokenHash,
          revokedAt: null,
          expiresAt: { $gt: now },
        },
        {
          $set: {
            revokedAt: now,
            replacedByTokenHash,
            lastUsedAt: now,
          },
        },
      );
    },
    revokeToken(tokenHash, now) {
      return collection.updateOne(
        { tokenHash, revokedAt: null },
        {
          $set: {
            revokedAt: now,
            replacedByTokenHash: null,
          },
        },
      );
    },
    revokeSession(sessionId, now) {
      return collection.updateMany(
        { sessionId, revokedAt: null },
        {
          $set: {
            revokedAt: now,
            replacedByTokenHash: null,
          },
        },
      );
    },
    revokeAllForUser(userId, now) {
      return collection.updateMany(
        {
          userId: toObjectId(userId),
          revokedAt: null,
        },
        {
          $set: {
            revokedAt: now,
            replacedByTokenHash: null,
          },
        },
      );
    },
  });
}
