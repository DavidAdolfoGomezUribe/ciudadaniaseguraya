import { toObjectId } from "../../../../shared/utils/object-id.js";

export function createReactionsRepository(db) {
  const collection = db.collection("reactions");

  return Object.freeze({
    async create(document) {
      const result = await collection.insertOne(document);
      return { _id: result.insertedId, ...document };
    },
    deleteById(reactionId) {
      return collection.deleteOne({ _id: toObjectId(reactionId) });
    },
    delete({ targetType, targetId, userId, reactionType }) {
      return collection.findOneAndDelete({
        targetType,
        targetId: toObjectId(targetId),
        userId: toObjectId(userId),
        reactionType,
      });
    },
  });
}
