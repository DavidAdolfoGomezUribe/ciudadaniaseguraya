import { toObjectId } from "../../../shared/utils/object-id.js";

export function createRefreshTokenRepository(db) {
  const collection = db.collection("refresh_tokens");

  return Object.freeze({
    create(document) {
      return collection.insertOne(document);
    },
    findUsable(tokenHash, now) {
      return collection.findOne(
        {
          tokenHash,
          revokedAt: null,
          expiresAt: { $gt: now },
        },
        {
          projection: {
            userId: 1,
            tokenHash: 1,
            expiresAt: 1,
            createdAt: 1,
          },
        },
      );
    },
    revokeActive(tokenHash, replacedByTokenHash, now) {
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
          },
        },
      );
    },
    revoke(tokenHash, now) {
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
