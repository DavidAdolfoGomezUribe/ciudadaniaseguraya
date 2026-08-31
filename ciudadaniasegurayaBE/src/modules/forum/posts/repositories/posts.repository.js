import { toObjectId } from "../../../../shared/utils/object-id.js";

const postProjection = {
  authorId: 1,
  title: 1,
  content: 1,
  tags: 1,
  relatedIncidentId: 1,
  status: 1,
  commentCount: 1,
  reactionCount: 1,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: 1,
  moderation: 1,
};

export function createPostsRepository(db) {
  const collection = db.collection("posts");

  return Object.freeze({
    async create(document) {
      const result = await collection.insertOne(document);
      return { _id: result.insertedId, ...document };
    },
    findById(postId) {
      return collection.findOne(
        { _id: toObjectId(postId) },
        { projection: postProjection },
      );
    },
    findActiveById(postId) {
      return collection.findOne(
        {
          _id: toObjectId(postId),
          status: "active",
          deletedAt: null,
        },
        { projection: postProjection },
      );
    },
    async list({ filter, skip, limit }) {
      return collection
        .find(
          {
            ...filter,
            status: "active",
            deletedAt: null,
          },
          { projection: postProjection },
        )
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
    },
    count(filter) {
      return collection.countDocuments({
        ...filter,
        status: "active",
        deletedAt: null,
      });
    },
    async listAdmin({ filter, skip, limit, sortBy, sortOrder }) {
      return collection
        .find(filter, { projection: postProjection })
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
    updateOwned(postId, authorId, changes, now) {
      return collection.findOneAndUpdate(
        {
          _id: toObjectId(postId),
          authorId: toObjectId(authorId),
          status: "active",
          deletedAt: null,
        },
        {
          $set: {
            ...changes,
            updatedAt: now,
          },
        },
        {
          projection: postProjection,
          returnDocument: "after",
        },
      );
    },
    deleteOwned(postId, authorId, now) {
      return collection.findOneAndUpdate(
        {
          _id: toObjectId(postId),
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
        { returnDocument: "after" },
      );
    },
    adjustCommentCount(postId, delta, now) {
      return collection.updateOne(
        {
          _id: toObjectId(postId),
          status: "active",
          ...(delta < 0 ? { commentCount: { $gte: 1 } } : {}),
        },
        {
          $inc: { commentCount: delta },
          $set: { updatedAt: now },
        },
      );
    },
    adjustReactionCount(postId, delta, now) {
      return collection.updateOne(
        {
          _id: toObjectId(postId),
          status: "active",
          ...(delta < 0 ? { reactionCount: { $gte: 1 } } : {}),
        },
        {
          $inc: { reactionCount: delta },
          $set: { updatedAt: now },
        },
      );
    },
    updateAdmin(postId, changes, moderation, now) {
      return collection.findOneAndUpdate(
        {
          _id: toObjectId(postId),
          status: { $ne: "deleted" },
        },
        {
          $set: {
            ...changes,
            moderation,
            updatedAt: now,
          },
        },
        {
          projection: postProjection,
          returnDocument: "after",
        },
      );
    },
    moderate(postId, status, moderation, now) {
      return collection.findOneAndUpdate(
        {
          _id: toObjectId(postId),
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
          projection: postProjection,
          returnDocument: "after",
        },
      );
    },
    deleteAdmin(postId, moderation, now) {
      return collection.findOneAndUpdate(
        {
          _id: toObjectId(postId),
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
          projection: postProjection,
          returnDocument: "after",
        },
      );
    },
  });
}
