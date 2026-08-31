import { success } from "../../../../shared/utils/response.js";

export function createAgentControlController(service) {
  return Object.freeze({
    async status(request) {
      return success(request, await service.status());
    },
    async start(request, reply) {
      const run = await service.start(
        request.body,
        request.authAdmin,
        request.id,
      );
      return reply.code(202).send(success(request, run));
    },
    async cancel(request) {
      return success(
        request,
        await service.cancel(
          request.params.runId,
          request.authAdmin,
          request.id,
        ),
      );
    },
  });
}
