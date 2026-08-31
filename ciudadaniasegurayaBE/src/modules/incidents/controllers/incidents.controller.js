import { paginated, success } from "../../../shared/utils/response.js";

export function createIncidentsController(incidentsService) {
  return Object.freeze({
    async getTypes(request) {
      return success(request, incidentsService.getTypes());
    },
    async createReport(request, reply) {
      const incident = await incidentsService.createReport(
        request.body,
        request.authUser,
      );
      return reply.code(201).send(success(request, incident));
    },
    async createAiIncident(request, reply) {
      const incident = await incidentsService.createAiIncident(request.body);
      return reply.code(201).send(success(request, incident));
    },
    async list(request) {
      const { incidents, total } = await incidentsService.list(request.query);
      return paginated(request, incidents, {
        page: request.query.page,
        pageSize: request.query.pageSize,
        total,
      });
    },
    async get(request) {
      return success(
        request,
        await incidentsService.get(request.params.incidentId),
      );
    },
    async nearby(request) {
      return success(request, await incidentsService.nearby(request.query));
    },
    async updateOwned(request) {
      return success(
        request,
        await incidentsService.updateOwned(
          request.params.incidentId,
          request.authUser.id,
          request.body,
        ),
      );
    },
    async deleteOwned(request, reply) {
      await incidentsService.deleteOwned(
        request.params.incidentId,
        request.authUser.id,
      );
      return reply.code(204).send();
    },
    async confirm(request) {
      return success(
        request,
        await incidentsService.confirm(
          request.params.incidentId,
          request.authUser.id,
        ),
      );
    },
    async removeConfirmation(request, reply) {
      await incidentsService.removeConfirmation(
        request.params.incidentId,
        request.authUser.id,
      );
      return reply.code(204).send();
    },
    async createAdmin(request, reply) {
      const incident = await incidentsService.createAdmin(
        request.body,
        request.authUser,
      );
      return reply.code(201).send(success(request, incident));
    },
    async listAdmin(request) {
      const { incidents, total } = await incidentsService.listAdmin(
        request.query,
      );
      return paginated(request, incidents, {
        page: request.query.page,
        pageSize: request.query.pageSize,
        total,
      });
    },
    async getAdmin(request) {
      return success(
        request,
        await incidentsService.getAdmin(
          request.params.incidentId,
          request.authUser,
        ),
      );
    },
    async updateAdmin(request) {
      return success(
        request,
        await incidentsService.updateAdmin(
          request.params.incidentId,
          request.body,
          request.authUser,
          request.id,
        ),
      );
    },
    async approve(request) {
      return success(
        request,
        await incidentsService.approve(
          request.params.incidentId,
          request.body,
          request.authUser,
          request.id,
        ),
      );
    },
    async reject(request) {
      return success(
        request,
        await incidentsService.reject(
          request.params.incidentId,
          request.body,
          request.authUser,
          request.id,
        ),
      );
    },
    async merge(request) {
      return success(
        request,
        await incidentsService.merge(
          request.params.incidentId,
          request.body,
          request.authUser,
          request.id,
        ),
      );
    },
    async claimReviewLock(request) {
      return success(
        request,
        await incidentsService.claimReviewLock(
          request.params.incidentId,
          request.body,
          request.authUser,
          request.id,
        ),
      );
    },
    async releaseReviewLock(request) {
      return success(
        request,
        await incidentsService.releaseReviewLock(
          request.params.incidentId,
          request.body,
          request.authUser,
          request.id,
        ),
      );
    },
  });
}
