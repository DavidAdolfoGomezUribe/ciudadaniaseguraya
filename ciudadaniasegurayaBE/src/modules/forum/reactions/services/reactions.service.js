import { MongoServerError } from "mongodb";

import {
  conflict,
  notFound,
} from "../../../../shared/errors/app-error.js";
import { toObjectId } from "../../../../shared/utils/object-id.js";

export function createReactionsService({
  reactionsRepository,
  postsRepository,
  commentsRepository,
  clock = () => new Date(),
}) {
  async function target(targetType, targetId) {
    const resource =
      targetType === "post"
        ? await postsRepository.findActiveById(targetId)
        : await commentsRepository.findActiveById(targetId);

    if (!resource) {
      throw notFound(targetType === "post" ? "Publicacion" : "Comentario");
    }

    return resource;
  }

  function adjustCount(targetType, targetId, delta, now) {
    return targetType === "post"
      ? postsRepository.adjustReactionCount(targetId, delta, now)
      : commentsRepository.adjustReactionCount(targetId, delta, now);
  }

  async function create({ targetType, targetId, userId, reactionType }) {
    await target(targetType, targetId);
    const now = clock();
    let reaction;

    try {
      reaction = await reactionsRepository.create({
        targetType,
        targetId: toObjectId(targetId),
        userId: toObjectId(userId),
        reactionType,
        createdAt: now,
      });
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw conflict(
          "Ya registraste esta reaccion",
          "REACTION_ALREADY_EXISTS",
        );
      }
      throw error;
    }

    const update = await adjustCount(targetType, targetId, 1, now);
    if (update.modifiedCount !== 1) {
      await reactionsRepository.deleteById(reaction._id);
      throw notFound(targetType === "post" ? "Publicacion" : "Comentario");
    }

    return {
      id: reaction._id.toHexString(),
      targetType,
      targetId: reaction.targetId.toHexString(),
      reactionType,
      createdAt: reaction.createdAt.toISOString(),
    };
  }

  async function remove({
    targetType,
    targetId,
    userId,
    reactionType,
  }) {
    const reaction = await reactionsRepository.delete({
      targetType,
      targetId,
      userId,
      reactionType,
    });

    if (reaction) {
      await adjustCount(targetType, targetId, -1, clock());
    }
  }

  return Object.freeze({
    create,
    remove,
  });
}
