import { ObjectId } from "mongodb";

import { toObjectId } from "../utils/object-id.js";

function nullableObjectId(value) {
  return value === null || value === undefined ? null : toObjectId(value);
}

function auditResourceId(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof ObjectId || ObjectId.isValid(value)) {
    return toObjectId(value);
  }
  return String(value);
}

export function createAuditRepository(db) {
  const collection = db.collection("audit_logs");

  return Object.freeze({
    record({
      actorId = null,
      actorUserId = actorId,
      actorRole = null,
      action,
      resourceType,
      resourceId = null,
      changes,
      previousValue = null,
      newValue = null,
      reason = null,
      metadata = {},
      requestId = null,
      operationKey = null,
      createdAt,
    }) {
      const normalizedActorId = nullableObjectId(actorUserId ?? actorId);
      const document = {
        actorId: normalizedActorId,
        actorUserId: normalizedActorId,
        actorRole,
        action,
        resourceType,
        resourceId: auditResourceId(resourceId),
        ...(changes === undefined ? {} : { changes }),
        previousValue,
        newValue,
        reason,
        metadata,
        requestId,
        ...(operationKey ? { operationKey } : {}),
        createdAt,
      };
      if (operationKey) {
        return collection.updateOne(
          { operationKey },
          { $setOnInsert: document },
          { upsert: true },
        );
      }
      return collection.insertOne(document);
    },
    async list({ filter, skip, limit }) {
      return collection
        .find(filter, {
          projection: {
            actorId: 1,
            actorUserId: 1,
            actorRole: 1,
            action: 1,
            resourceType: 1,
            resourceId: 1,
            changes: 1,
            previousValue: 1,
            newValue: 1,
            reason: 1,
            metadata: 1,
            requestId: 1,
            operationKey: 1,
            createdAt: 1,
          },
        })
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();
    },
    count(filter) {
      return collection.countDocuments(filter);
    },
  });
}
