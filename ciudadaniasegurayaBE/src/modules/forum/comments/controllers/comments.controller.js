import { paginated, success } from "../../../../shared/utils/response.js";

export function createCommentsController(commentsService) {
  return Object.freeze({
    async create(request, reply) {
      const comment = await commentsService.create(
        request.params.postId,
        request.body,
        request.authUser.id,
      );
      return reply.code(201).send(success(request, comment));
    },
    async list(request) {
      const { comments, total } = await commentsService.list(
        request.params.postId,
        request.query,
      );
      return paginated(request, comments, {
        page: request.query.page,
        pageSize: request.query.pageSize,
        total,
      });
    },
    async listAdmin(request) {
      const { comments, total } = await commentsService.listAdmin(
        request.query,
      );
      return paginated(request, comments, {
        page: request.query.page,
        pageSize: request.query.pageSize,
        total,
      });
    },
    async getAdmin(request) {
      return success(
        request,
        await commentsService.getAdmin(request.params.commentId),
      );
    },
    async update(request) {
      return success(
        request,
        await commentsService.update(
          request.params.commentId,
          request.authUser.id,
          request.body.content,
        ),
      );
    },
    async remove(request, reply) {
      await commentsService.remove(
        request.params.commentId,
        request.authUser.id,
      );
      return reply.code(204).send();
    },
    async moderate(request) {
      return success(
        request,
        await commentsService.moderate(
          request.params.commentId,
          request.body.status,
          request.authUser,
          request.body.reason,
          request.id,
        ),
      );
    },
    async updateAdmin(request) {
      return success(
        request,
        await commentsService.updateAdmin(
          request.params.commentId,
          request.body,
          request.authUser,
          request.id,
        ),
      );
    },
    async hideAdmin(request) {
      return success(
        request,
        await commentsService.moderate(
          request.params.commentId,
          "hidden",
          request.authUser,
          request.body.reason,
          request.id,
        ),
      );
    },
    async restoreAdmin(request) {
      return success(
        request,
        await commentsService.moderate(
          request.params.commentId,
          "active",
          request.authUser,
          request.body.reason,
          request.id,
        ),
      );
    },
    async deleteAdmin(request, reply) {
      await commentsService.deleteAdmin(
        request.params.commentId,
        request.authUser,
        request.body.reason,
        request.id,
      );
      return reply.code(204).send();
    },
  });
}
