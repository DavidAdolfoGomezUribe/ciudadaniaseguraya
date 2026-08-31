import { toObjectId } from "../../../shared/utils/object-id.js";

export function createAccountContentRepository(db) {
  const posts = db.collection("posts");
  const comments = db.collection("comments");

  return Object.freeze({
    async markAuthorDeleted(userId, now) {
      const authorId = toObjectId(userId);
      await Promise.all([
        posts.updateMany(
          {
            authorId,
            status: { $ne: "deleted" },
          },
          {
            $set: {
              status: "deleted",
              deletedAt: now,
              updatedAt: now,
            },
          },
        ),
        comments.updateMany(
          {
            authorId,
            status: { $ne: "deleted" },
          },
          {
            $set: {
              status: "deleted",
              deletedAt: now,
              updatedAt: now,
            },
          },
        ),
      ]);
    },
  });
}
