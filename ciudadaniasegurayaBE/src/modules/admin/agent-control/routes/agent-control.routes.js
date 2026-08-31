import {
  errorResponseSchema,
  successResponseSchema,
} from "../../../../shared/utils/api-schemas.js";
import {
  agentRunBodySchema,
  agentRunParamsSchema,
} from "../validators/agent-control.schemas.js";

const errors = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
  503: errorResponseSchema,
};

export async function registerAgentControlRoutes(
  app,
  { controller, authenticateAdmin, requirePermission },
) {
  const guarded = [authenticateAdmin, requirePermission("agent.control")];
  const common = {
    tags: ["Admin agent"],
    security: [{ bearerAuth: [] }],
  };

  app.get(
    "/api/v1/admin/agent",
    {
      preHandler: guarded,
      schema: {
        ...common,
        summary: "Consulta salud, proveedores, corrida y logs del agente",
        response: { 200: successResponseSchema, ...errors },
      },
    },
    controller.status,
  );

  app.post(
    "/api/v1/admin/agent/runs",
    {
      preHandler: guarded,
      schema: {
        ...common,
        summary: "Inicia una corrida aprobada por el superadministrador",
        body: agentRunBodySchema,
        response: { 202: successResponseSchema, ...errors },
      },
    },
    controller.start,
  );

  app.post(
    "/api/v1/admin/agent/runs/:runId/cancel",
    {
      preHandler: guarded,
      schema: {
        ...common,
        summary: "Solicita la cancelacion segura de la corrida activa",
        params: agentRunParamsSchema,
        response: { 200: successResponseSchema, ...errors },
      },
    },
    controller.cancel,
  );
}
