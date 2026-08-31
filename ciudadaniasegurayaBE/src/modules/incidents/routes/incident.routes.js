import {
  emptyResponseSchema,
  errorResponseSchema,
  paginatedResponseSchema,
  successResponseSchema,
} from "../../../shared/utils/api-schemas.js";
import { AppError } from "../../../shared/errors/app-error.js";
import {
  aiIncidentBodySchema,
  adminListIncidentsQuerySchema,
  adminCreateIncidentBodySchema,
  adminUpdateIncidentBodySchema,
  approveIncidentBodySchema,
  incidentIdParamsSchema,
  listIncidentsQuerySchema,
  mergeIncidentBodySchema,
  nearbyIncidentsQuerySchema,
  rejectIncidentBodySchema,
  releaseReviewLockBodySchema,
  reportIncidentBodySchema,
  reviewLockBodySchema,
  updateIncidentBodySchema,
} from "../validators/incident.schemas.js";

export async function registerIncidentRoutes(
  app,
  {
    controller,
    authenticate,
    authenticateAiIngest,
    requireAdmin,
    requirePermission,
  },
) {
  const adminGuard = (permission) =>
    requirePermission ? requirePermission(permission) : requireAdmin;
  const aiIngestGuard =
    authenticateAiIngest ??
    (async () => {
      throw new AppError({
        code: "AI_INGEST_DISABLED",
        message: "La integracion de incidentes con IA no esta configurada",
        statusCode: 503,
      });
    });
  app.get(
    "/api/v1/incidents/types",
    {
      schema: {
        tags: ["Incidents"],
        summary: "Lista las categorias admitidas",
        response: { 200: successResponseSchema },
      },
    },
    controller.getTypes,
  );

  app.post(
    "/api/v1/incidents/reports",
    {
      preHandler: authenticate,
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 hour",
        },
      },
      schema: {
        tags: ["Incidents"],
        summary: "Reporta o correlaciona un incidente ciudadano",
        description:
          "Correlaciona por ciudad, tipo, ventana temporal y celda H3 vecina. El reportante cuenta una vez.",
        security: [{ bearerAuth: [] }],
        body: reportIncidentBodySchema,
        response: {
          201: successResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          409: errorResponseSchema,
          422: errorResponseSchema,
          429: errorResponseSchema,
        },
      },
    },
    controller.createReport,
  );

  app.post(
    "/api/v1/integrations/ai/incidents",
    {
      preHandler: aiIngestGuard,
      config: {
        rateLimit: {
          max: 60,
          timeWindow: "1 minute",
        },
      },
      schema: {
        tags: ["Integrations", "Incidents"],
        summary: "Ingiere un incidente pendiente desde el scraper con IA",
        description:
          "Valida fecha, coordenadas y limites de la ciudad. No genera una confirmacion comunitaria y siempre identifica el origen como ai_scraper.",
        security: [{ aiIngestKey: [] }],
        body: aiIncidentBodySchema,
        response: {
          201: successResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          422: errorResponseSchema,
          429: errorResponseSchema,
          503: errorResponseSchema,
        },
      },
    },
    controller.createAiIncident,
  );

  app.get(
    "/api/v1/incidents",
    {
      schema: {
        tags: ["Incidents"],
        summary: "Lista incidentes visibles y paginados",
        querystring: listIncidentsQuerySchema,
        response: {
          200: paginatedResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    controller.list,
  );

  app.get(
    "/api/v1/incidents/nearby",
    {
      schema: {
        tags: ["Incidents"],
        summary: "Busca incidentes validados cercanos",
        querystring: nearbyIncidentsQuerySchema,
        response: {
          200: successResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    controller.nearby,
  );

  app.get(
    "/api/v1/incidents/:incidentId",
    {
      schema: {
        tags: ["Incidents"],
        summary: "Consulta un incidente validado",
        params: incidentIdParamsSchema,
        response: {
          200: successResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    controller.get,
  );

  app.patch(
    "/api/v1/incidents/:incidentId",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Incidents"],
        summary: "Edita un incidente pendiente propio",
        security: [{ bearerAuth: [] }],
        params: incidentIdParamsSchema,
        body: updateIncidentBodySchema,
        response: {
          200: successResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          422: errorResponseSchema,
        },
      },
    },
    controller.updateOwned,
  );

  app.delete(
    "/api/v1/incidents/:incidentId",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Incidents"],
        summary: "Archiva un incidente pendiente propio",
        security: [{ bearerAuth: [] }],
        params: incidentIdParamsSchema,
        response: {
          204: emptyResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    controller.deleteOwned,
  );

  app.post(
    "/api/v1/incidents/:incidentId/confirm",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Incidents"],
        summary: "Confirma un incidente una sola vez",
        security: [{ bearerAuth: [] }],
        params: incidentIdParamsSchema,
        response: {
          200: successResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    controller.confirm,
  );

  app.delete(
    "/api/v1/incidents/:incidentId/confirm",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Incidents"],
        summary: "Retira una confirmacion propia",
        security: [{ bearerAuth: [] }],
        params: incidentIdParamsSchema,
        response: {
          204: emptyResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    controller.removeConfirmation,
  );

  app.post(
    "/api/v1/admin/incidents",
    {
      preHandler: adminGuard("incidents.createVerified"),
      schema: {
        tags: ["Admin"],
        summary: "Crea un incidente validado por administracion",
        security: [{ bearerAuth: [] }],
        body: adminCreateIncidentBodySchema,
        response: {
          201: successResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          422: errorResponseSchema,
        },
      },
    },
    controller.createAdmin,
  );

  app.get(
    "/api/v1/admin/incidents",
    {
      preHandler: adminGuard("incidents.read"),
      schema: {
        tags: ["Admin", "Incident Moderation"],
        summary: "Lista incidentes para moderacion administrativa",
        security: [{ bearerAuth: [] }],
        querystring: adminListIncidentsQuerySchema,
        response: {
          200: paginatedResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
        },
      },
    },
    controller.listAdmin,
  );

  app.get(
    "/api/v1/admin/incidents/:incidentId",
    {
      preHandler: adminGuard("incidents.read"),
      schema: {
        tags: ["Admin", "Incident Moderation"],
        summary: "Consulta el detalle administrativo de un incidente",
        security: [{ bearerAuth: [] }],
        params: incidentIdParamsSchema,
        response: {
          200: successResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    controller.getAdmin,
  );

  app.patch(
    "/api/v1/admin/incidents/:incidentId",
    {
      preHandler: adminGuard("incidents.update"),
      schema: {
        tags: ["Admin"],
        summary: "Edita un incidente como administrador",
        security: [{ bearerAuth: [] }],
        params: incidentIdParamsSchema,
        body: adminUpdateIncidentBodySchema,
        response: {
          200: successResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          422: errorResponseSchema,
        },
      },
    },
    controller.updateAdmin,
  );

  for (const [path, summary, body, handler] of [
    [
      "approve",
      "Aprueba un incidente",
      approveIncidentBodySchema,
      controller.approve,
    ],
    [
      "reject",
      "Rechaza un incidente",
      rejectIncidentBodySchema,
      controller.reject,
    ],
  ]) {
    app.post(
      `/api/v1/admin/incidents/:incidentId/${path}`,
      {
        preHandler: adminGuard(
          path === "approve" ? "incidents.approve" : "incidents.reject",
        ),
        schema: {
          tags: ["Admin"],
          summary,
          security: [{ bearerAuth: [] }],
          params: incidentIdParamsSchema,
          body,
          response: {
            200: successResponseSchema,
            400: errorResponseSchema,
            401: errorResponseSchema,
            403: errorResponseSchema,
            409: errorResponseSchema,
          },
        },
      },
      handler,
    );
  }

  app.post(
    "/api/v1/admin/incidents/:incidentId/merge",
    {
      preHandler: adminGuard("incidents.merge"),
      schema: {
        tags: ["Admin"],
        summary: "Fusiona un incidente duplicado en el principal",
        security: [{ bearerAuth: [] }],
        params: incidentIdParamsSchema,
        body: mergeIncidentBodySchema,
        response: {
          200: successResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    controller.merge,
  );

  app.post(
    "/api/v1/admin/incidents/:incidentId/review-lock",
    {
      preHandler: adminGuard("incidents.update"),
      schema: {
        tags: ["Admin", "Incident Moderation"],
        summary: "Reclama temporalmente un incidente para revision",
        security: [{ bearerAuth: [] }],
        params: incidentIdParamsSchema,
        body: reviewLockBodySchema,
        response: {
          200: successResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    controller.claimReviewLock,
  );

  app.delete(
    "/api/v1/admin/incidents/:incidentId/review-lock",
    {
      preHandler: adminGuard("incidents.update"),
      schema: {
        tags: ["Admin", "Incident Moderation"],
        summary: "Libera el bloqueo temporal de revision",
        security: [{ bearerAuth: [] }],
        params: incidentIdParamsSchema,
        body: releaseReviewLockBodySchema,
        response: {
          200: successResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    controller.releaseReviewLock,
  );
}
