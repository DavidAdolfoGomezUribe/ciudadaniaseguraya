import { toObjectId } from "../../../../shared/utils/object-id.js";

const commentProjection = {
  postId: 1,
  authorId: 1,
  parentCommentId: 1,
  content: 1,
  status: 1,
  reactionCount: 1,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: 1,
  moderation: 1,
};

export function createCommentsRepository(db) {
  const collection = db.collection("comments");

  return Object.freeze({
    async create(document) {
      const result = await collection.insertOne(document);
      return { _id: result.insertedId, ...document };
    },
    deleteHard(commentId) {
      return collection.deleteOne({ _id: toObjectId(commentId) });
    },
    findById(commentId) {
      return collection.findOne(
        { _id: toObjectId(commentId) },
        { projection: commentProjection },
      );
    },
    findActiveById(commentId) {
      return collection.findOne(
        {
          _id: toObjectId(commentId),
          status: "active",
          deletedAt: null,
        },
        { projection: commentProjection },
      );
    },
    async listByPost({ postId, skip, limit }) {
      return collection
        .find(
          {
            postId: toObjectId(postId),
            status: "active",
            deletedAt: null,
          },
          { projection: commentProjection },
        )
        .sort({ createdAt: 1, _id: 1 })
        .skip(skip)
        .limit(limit)
        .toArray();
    },
    countByPost(postId) {
      return collection.countDocuments({
        postId: toObjectId(postId),
        status: "active",
        deletedAt: null,
      });
    },
    async listAdmin({ filter, skip, limit, sortBy, sortOrder }) {
      return collection
        .find(filter, { projection: commentProjection })
        .sort({
          [sortBy]: sortOrder === "asc" ? 1 : -1,
          _id: sortOrder === "asc" ? 1 : -1,
        })
        .skip(skip)
        .limit(limit)
        .toArray();
    },
    countAdmin(filter) {
      return collection.countDocuments(filter);
    },
    updateOwned(commentId, authorId, content, now) {
      return collection.findOneAndUpdate(
        {
          _id: toObjectId(commentId),
          authorId: toObjectId(authorId),
          status: "active",
          deletedAt: null,
        },
        {
          $set: {
            content,
            updatedAt: now,
          },
        },
        {
          projection: commentProjection,
          returnDocument: "after",
        },
      );
    },
    deleteOwned(commentId, authorId, now) {
      return collection.findOneAndUpdate(
        {
          _id: toObjectId(commentId),
          authorId: toObjectId(authorId),
          status: "active",
          deletedAt: null,
        },
        {
          $set: {
            status: "deleted",
            deletedAt: now,
            updatedAt: now,
          },
        },
        {
          projection: commentProjection,
          returnDocument: "after",
        },
      );
    },
    adjustReactionCount(commentId, delta, now) {
      return collection.updateOne(
        {
          _id: toObjectId(commentId),
          status: "active",
          ...(delta < 0 ? { reactionCount: { $gte: 1 } } : {}),
        },
        {
          $inc: { reactionCount: delta },
          $set: { updatedAt: now },
        },
      );
    },
    updateAdmin(commentId, content, moderation, now) {
      return collection.findOneAndUpdate(
        {
          _id: toObjectId(commentId),
          status: { $ne: "deleted" },
        },
        {
          $set: {
            content,
            moderation,
            updatedAt: now,
          },
        },
        {
          projection: commentProjection,
          returnDocument: "after",
        },
      );
    },
    moderate(commentId, status, moderation, now) {
      return collection.findOneAndUpdate(
        {
          _id: toObjectId(commentId),
          status: { $in: ["active", "hidden"] },
        },
        {
          $set: {
            status,
            moderation,
            updatedAt: now,
          },
        },
        {
          projection: commentProjection,
          returnDocument: "after",
        },
      );
    },
    deleteAdmin(commentId, moderation, now) {
      return collection.findOneAndUpdate(
        {
          _id: toObjectId(commentId),
          status: { $ne: "deleted" },
        },
        {
          $set: {
            status: "deleted",
            moderation,
            deletedAt: now,
            updatedAt: now,
          },
        },
        {
          projection: commentProjection,
          returnDocument: "after",
        },
      );
    },
  });
}
