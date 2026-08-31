import { success } from "../../../../shared/utils/response.js";

export function createReactionsController(reactionsService) {
  return Object.freeze({
    async createPost(request, reply) {
      const reaction = await reactionsService.create({
        targetType: "post",
        targetId: request.params.postId,
        userId: request.authUser.id,
        reactionType: request.body.reactionType,
      });
      return reply.code(201).send(success(request, reaction));
    },
    async removePost(request, reply) {
      await reactionsService.remove({
        targetType: "post",
        targetId: request.params.postId,
        userId: request.authUser.id,
        reactionType: request.params.reactionType,
      });
      return reply.code(204).send();
    },
    async createComment(request, reply) {
      const reaction = await reactionsService.create({
        targetType: "comment",
        targetId: request.params.commentId,
        userId: request.authUser.id,
        reactionType: request.body.reactionType,
      });
      return reply.code(201).send(success(request, reaction));
    },
    async removeComment(request, reply) {
      await reactionsService.remove({
        targetType: "comment",
        targetId: request.params.commentId,
        userId: request.authUser.id,
        reactionType: request.params.reactionType,
      });
      return reply.code(204).send();
    },
  });
}
