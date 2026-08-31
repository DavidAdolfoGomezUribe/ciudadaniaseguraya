import { paginated, success } from "../../../../shared/utils/response.js";

export function createPostsController(postsService) {
  return Object.freeze({
    async create(request, reply) {
      const post = await postsService.create(
        request.body,
        request.authUser.id,
      );
      return reply.code(201).send(success(request, post));
    },
    async list(request) {
      const { posts, total } = await postsService.list(request.query);
      return paginated(request, posts, {
        page: request.query.page,
        pageSize: request.query.pageSize,
        total,
      });
    },
    async get(request) {
      return success(request, await postsService.get(request.params.postId));
    },
    async listAdmin(request) {
      const { posts, total } = await postsService.listAdmin(request.query);
      return paginated(request, posts, {
        page: request.query.page,
        pageSize: request.query.pageSize,
        total,
      });
    },
    async getAdmin(request) {
      return success(
        request,
        await postsService.getAdmin(request.params.postId),
      );
    },
    async update(request) {
      return success(
        request,
        await postsService.update(
          request.params.postId,
          request.authUser.id,
          request.body,
        ),
      );
    },
    async remove(request, reply) {
      await postsService.remove(
        request.params.postId,
        request.authUser.id,
      );
      return reply.code(204).send();
    },
    async moderate(request) {
      return success(
        request,
        await postsService.moderate(
          request.params.postId,
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
        await postsService.updateAdmin(
          request.params.postId,
          request.body,
          request.authUser,
          request.id,
        ),
      );
    },
    async hideAdmin(request) {
      return success(
        request,
        await postsService.moderate(
          request.params.postId,
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
        await postsService.moderate(
          request.params.postId,
          "active",
          request.authUser,
          request.body.reason,
          request.id,
        ),
      );
    },
    async deleteAdmin(request, reply) {
      await postsService.deleteAdmin(
        request.params.postId,
        request.authUser,
        request.body.reason,
        request.id,
      );
      return reply.code(204).send();
    },
  });
}
