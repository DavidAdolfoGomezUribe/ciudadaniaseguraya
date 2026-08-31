import { toObjectId } from "../../../shared/utils/object-id.js";

const authenticationProjection = {
  email: 1,
  normalizedEmail: 1,
  username: 1,
  normalizedUsername: 1,
  displayName: 1,
  passwordHash: 1,
  googleSubject: 1,
  role: 1,
  status: 1,
  emailVerified: 1,
  createdAt: 1,
  updatedAt: 1,
  deletedAt: 1,
  lastLoginAt: 1,
  adminMetadata: 1,
};

export function createUsersRepository(db) {
  const collection = db.collection("users");

  return Object.freeze({
    create(document) {
      return collection.insertOne(document);
    },
    findById(userId) {
      return collection.findOne(
        { _id: toObjectId(userId) },
        { projection: authenticationProjection },
      );
    },
    findByNormalizedEmail(normalizedEmail) {
      return collection.findOne(
        { normalizedEmail },
        { projection: authenticationProjection },
      );
    },
    findByNormalizedUsername(normalizedUsername) {
      return collection.findOne(
        { normalizedUsername },
        { projection: authenticationProjection },
      );
    },
    findByGoogleSubject(googleSubject) {
      return collection.findOne(
        { googleSubject },
        { projection: authenticationProjection },
      );
    },
    findByLogin(normalizedIdentifier) {
      return collection.findOne(
        {
          $or: [
            { normalizedEmail: normalizedIdentifier },
            { normalizedUsername: normalizedIdentifier },
          ],
        },
        { projection: authenticationProjection },
      );
    },
    findBootstrapSuperadmin() {
      return collection.findOne(
        {
          role: "superadmin",
          "adminMetadata.isBootstrapSuperadmin": true,
        },
        { projection: authenticationProjection },
      );
    },
    findSuperadmins() {
      return collection
        .find(
          { role: "superadmin" },
          { projection: authenticationProjection },
        )
        .limit(2)
        .toArray();
    },
    findPublicById(userId) {
      return collection.findOne(
        {
          _id: toObjectId(userId),
          status: "active",
        },
        {
          projection: {
            username: 1,
            createdAt: 1,
          },
        },
      );
    },
    updateLastLogin(userId, now) {
      return collection.updateOne(
        { _id: toObjectId(userId), status: "active" },
        {
          $set: {
            lastLoginAt: now,
            updatedAt: now,
          },
        },
      );
    },
    linkGoogleIdentity(userId, googleSubject, now) {
      return collection.findOneAndUpdate(
        {
          _id: toObjectId(userId),
          status: "active",
          $or: [
            { googleSubject: { $exists: false } },
            { googleSubject },
          ],
        },
        {
          $set: {
            googleSubject,
            emailVerified: true,
            updatedAt: now,
          },
        },
        {
          projection: authenticationProjection,
          returnDocument: "after",
        },
      );
    },
    async updateProfile(userId, changes, now) {
      return collection.findOneAndUpdate(
        { _id: toObjectId(userId), role: "user", status: "active" },
        {
          $set: {
            ...changes,
            updatedAt: now,
          },
        },
        {
          projection: authenticationProjection,
          returnDocument: "after",
        },
      );
    },
    async anonymize(userId, anonymousValues, now) {
      return collection.findOneAndUpdate(
        {
          _id: toObjectId(userId),
          role: "user",
          status: { $ne: "deleted" },
        },
        {
          $set: {
            ...anonymousValues,
            status: "deleted",
            emailVerified: false,
            deletedAt: now,
            updatedAt: now,
          },
          $unset: {
            googleSubject: "",
          },
        },
        {
          projection: authenticationProjection,
          returnDocument: "after",
        },
      );
    },
    async list({ filter, skip, limit }) {
      return collection
        .find(filter, { projection: authenticationProjection })
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
    },
    count(filter) {
      return collection.countDocuments(filter);
    },
    async updateStatus(userId, status, now) {
      return collection.findOneAndUpdate(
        { _id: toObjectId(userId), status: { $ne: "deleted" } },
        {
          $set: {
            status,
            updatedAt: now,
          },
        },
        {
          projection: authenticationProjection,
          returnDocument: "after",
        },
      );
    },
    async updateBootstrapSuperadmin(userId, changes, now) {
      return collection.findOneAndUpdate(
        { _id: toObjectId(userId) },
        {
          $set: {
            ...changes,
            role: "superadmin",
            status: "active",
            emailVerified: true,
            deletedAt: null,
            "adminMetadata.isBootstrapSuperadmin": true,
            updatedAt: now,
          },
        },
        {
          projection: authenticationProjection,
          returnDocument: "after",
        },
      );
    },
  });
}
