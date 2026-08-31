import {
  paginated,
  success,
} from "../../../../shared/utils/response.js";

function actorOf(request) {
  return request.authAdmin ?? request.authUser;
}

export function createAdminManagementController(service) {
  return Object.freeze({
    async dashboard(request) {
      return success(request, await service.dashboard(actorOf(request)));
    },

    async listUsers(request) {
      const result = await service.listUsers(request.query);
      return paginated(request, result.items, {
        page: request.query.page,
        pageSize: request.query.pageSize,
        total: result.total,
      });
    },

    async getUser(request) {
      return success(
        request,
        await service.getUser(request.params.userId, actorOf(request)),
      );
    },

    async updateUser(request) {
      return success(
        request,
        await service.updateUser(
          request.params.userId,
          request.body,
          actorOf(request),
          request.id,
        ),
      );
    },

    async suspendUser(request) {
      return success(
        request,
        await service.suspendUser(
          request.params.userId,
          request.body.reason,
          actorOf(request),
          request.id,
        ),
      );
    },

    async reactivateUser(request) {
      return success(
        request,
        await service.reactivateUser(
          request.params.userId,
          request.body.reason,
          actorOf(request),
          request.id,
        ),
      );
    },

    async deleteUser(request, reply) {
      await service.deleteUser(
        request.params.userId,
        request.body,
        actorOf(request),
        request.id,
      );
      return reply.code(204).send();
    },

    async revokeUserSessions(request) {
      return success(
        request,
        await service.revokeUserSessions(
          request.params.userId,
          request.body.reason,
          actorOf(request),
          request.id,
        ),
      );
    },

    async listAdministrators(request) {
      const result = await service.listAdministrators(
        request.query,
        actorOf(request),
      );
      return paginated(request, result.items, {
        page: request.query.page,
        pageSize: request.query.pageSize,
        total: result.total,
      });
    },

    async getAdministrator(request) {
      return success(
        request,
        await service.getAdministrator(
          request.params.adminId,
          actorOf(request),
        ),
      );
    },

    async promoteUser(request) {
      return success(
        request,
        await service.promoteUser(
          request.params.userId,
          request.body.reason,
          actorOf(request),
          request.id,
        ),
      );
    },

    async demoteAdministrator(request) {
      return success(
        request,
        await service.demoteAdministrator(
          request.params.adminId,
          request.body.reason,
          actorOf(request),
          request.id,
        ),
      );
    },

    async suspendAdministrator(request) {
      return success(
        request,
        await service.suspendAdministrator(
          request.params.adminId,
          request.body.reason,
          actorOf(request),
          request.id,
        ),
      );
    },

    async reactivateAdministrator(request) {
      return success(
        request,
        await service.reactivateAdministrator(
          request.params.adminId,
          request.body.reason,
          actorOf(request),
          request.id,
        ),
      );
    },

    async revokeAdministratorSessions(request) {
      return success(
        request,
        await service.revokeAdministratorSessions(
          request.params.adminId,
          request.body.reason,
          actorOf(request),
          request.id,
        ),
      );
    },

    async createOwnRoleRequest(request, reply) {
      const item = await service.createRoleRequest(
        request.body,
        actorOf(request),
        undefined,
        request.id,
      );
      return reply.code(201).send(success(request, item));
    },

    async createRecommendation(request, reply) {
      const item = await service.createRoleRequest(
        request.body,
        actorOf(request),
        request.body.candidateUserId,
        request.id,
      );
      return reply.code(201).send(success(request, item));
    },

    async listOwnRoleRequests(request) {
      const result = await service.listOwnRoleRequests(
        actorOf(request),
        request.query,
      );
      return paginated(request, result.items, {
        page: request.query.page,
        pageSize: request.query.pageSize,
        total: result.total,
      });
    },

    async listRoleRequests(request) {
      const result = await service.listRoleRequests(request.query);
      return paginated(request, result.items, {
        page: request.query.page,
        pageSize: request.query.pageSize,
        total: result.total,
      });
    },

    async getRoleRequest(request) {
      return success(
        request,
        await service.getRoleRequest(request.params.requestId),
      );
    },

    async cancelRoleRequest(request, reply) {
      await service.cancelRoleRequest(
        request.params.requestId,
        actorOf(request),
        request.id,
      );
      return reply.code(204).send();
    },

    async approveRoleRequest(request) {
      return success(
        request,
        await service.approveRoleRequest(
          request.params.requestId,
          request.body.reason,
          actorOf(request),
          request.id,
        ),
      );
    },

    async rejectRoleRequest(request) {
      return success(
        request,
        await service.rejectRoleRequest(
          request.params.requestId,
          request.body.reason,
          actorOf(request),
          request.id,
        ),
      );
    },

    async requestRoleInformation(request) {
      return success(
        request,
        await service.requestRoleInformation(
          request.params.requestId,
          request.body.reason,
          actorOf(request),
          request.id,
        ),
      );
    },

    async listAudit(request) {
      const result = await service.listAudit(
        request.query,
        actorOf(request),
      );
      return paginated(request, result.items, {
        page: request.query.page,
        pageSize: request.query.pageSize,
        total: result.total,
      });
    },

    async listSettings(request) {
      return success(request, await service.listSettings());
    },

    async updateSetting(request) {
      return success(
        request,
        await service.updateSetting(
          request.body,
          actorOf(request),
          request.id,
        ),
      );
    },
  });
}
