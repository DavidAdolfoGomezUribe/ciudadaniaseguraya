import { paginated, success } from "../../../shared/utils/response.js";
import { clearRefreshCookie } from "../../auth/http/refresh-cookie.js";

export function createUsersController(usersService, config) {
  return Object.freeze({
    async getPublic(request) {
      return success(
        request,
        await usersService.getPublic(request.params.userId),
      );
    },
    async updateOwn(request) {
      return success(
        request,
        await usersService.updateOwn(request.authUser.id, request.body),
      );
    },
    async deleteOwn(request, reply) {
      await usersService.deleteOwn(request.authUser.id);
      clearRefreshCookie(reply, config);
      return reply.code(204).send();
    },
    async listAdmin(request) {
      const { users, total } = await usersService.listAdmin(request.query);
      return paginated(request, users, {
        page: request.query.page,
        pageSize: request.query.pageSize,
        total,
      });
    },
    async getAdmin(request) {
      return success(
        request,
        await usersService.getAdmin(request.params.userId),
      );
    },
    async updateStatus(request) {
      return success(
        request,
        await usersService.updateStatus({
          actorId: request.authUser.id,
          userId: request.params.userId,
          status: request.body.status,
        }),
      );
    },
    async listAuditLogs(request) {
      const { logs, total } = await usersService.listAuditLogs(request.query);
      return paginated(request, logs, {
        page: request.query.page,
        pageSize: request.query.pageSize,
        total,
      });
    },
  });
}
