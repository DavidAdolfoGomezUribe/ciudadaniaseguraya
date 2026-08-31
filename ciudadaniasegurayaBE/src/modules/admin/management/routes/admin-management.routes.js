import {
  emptyResponseSchema,
  errorResponseSchema,
  paginatedResponseSchema,
  successResponseSchema,
} from "../../../../shared/utils/api-schemas.js";
import {
  adminRecommendationBodySchema,
  adminResourceParamsSchema,
  administratorsQuerySchema,
  adminUsersQuerySchema,
  auditQuerySchema,
  deleteAdminUserBodySchema,
  reasonBodySchema,
  roleRequestBodySchema,
  roleRequestsQuerySchema,
  updateAdminUserBodySchema,
  updateSettingBodySchema,
} from "../validators/admin-management.schemas.js";

const commonAdminErrors = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  404: errorResponseSchema,
  409: errorResponseSchema,
};

const adminSecurity = [{ bearerAuth: [] }];

export async function registerAdminManagementRoutes(
  app,
  {
    controller,
    authenticate,
    authenticateAdmin,
    requirePermission,
  },
) {
  const guarded = (permission) => [
    authenticateAdmin,
    requirePermission(permission),
  ];

  app.get(
    "/api/v1/admin/dashboard",
    {
      preHandler: guarded("admin.dashboard.read"),
      schema: {
        tags: ["Admin"],
        summary: "Resume la actividad que requiere atencion administrativa",
        security: adminSecurity,
        response: {
          200: successResponseSchema,
          ...commonAdminErrors,
        },
      },
    },
    controller.dashboard,
  );

  app.get(
    "/api/v1/admin/users",
    {
      preHandler: guarded("users.read"),
      schema: {
        tags: ["Admin users"],
        summary: "Lista cuentas de usuario normales",
        security: adminSecurity,
        querystring: adminUsersQuerySchema,
        response: {
          200: paginatedResponseSchema,
          ...commonAdminErrors,
        },
      },
    },
    controller.listUsers,
  );

  app.get(
    "/api/v1/admin/users/:userId",
    {
      preHandler: guarded("users.read"),
      schema: {
        tags: ["Admin users"],
        summary: "Consulta una cuenta de usuario normal",
        security: adminSecurity,
        params: adminResourceParamsSchema,
        response: {
          200: successResponseSchema,
          ...commonAdminErrors,
        },
      },
    },
    controller.getUser,
  );

  app.patch(
    "/api/v1/admin/users/:userId",
    {
      preHandler: guarded("users.update"),
      schema: {
        tags: ["Admin users"],
        summary: "Edita campos permitidos de una cuenta normal",
        security: adminSecurity,
        params: adminResourceParamsSchema,
        body: updateAdminUserBodySchema,
        response: {
          200: successResponseSchema,
          ...commonAdminErrors,
        },
      },
    },
    controller.updateUser,
  );

  for (const [action, permission, summary, handler] of [
    [
      "suspend",
      "users.suspend",
      "Suspende una cuenta normal",
      controller.suspendUser,
    ],
    [
      "reactivate",
      "users.suspend",
      "Reactiva una cuenta normal",
      controller.reactivateUser,
    ],
    [
      "revoke-sessions",
      "sessions.revoke",
      "Revoca las sesiones de una cuenta normal",
      controller.revokeUserSessions,
    ],
  ]) {
    app.post(
      `/api/v1/admin/users/:userId/${action}`,
      {
        preHandler: guarded(permission),
        schema: {
          tags: ["Admin users"],
          summary,
          security: adminSecurity,
          params: adminResourceParamsSchema,
          body: reasonBodySchema,
          response: {
            200: successResponseSchema,
            ...commonAdminErrors,
          },
        },
      },
      handler,
    );
  }

  app.delete(
    "/api/v1/admin/users/:userId",
    {
      preHandler: guarded("users.delete"),
      schema: {
        tags: ["Admin users"],
        summary: "Anonimiza y elimina logicamente una cuenta normal",
        security: adminSecurity,
        params: adminResourceParamsSchema,
        body: deleteAdminUserBodySchema,
        response: {
          204: emptyResponseSchema,
          ...commonAdminErrors,
        },
      },
    },
    controller.deleteUser,
  );

  app.get(
    "/api/v1/admin/administrators",
    {
      preHandler: guarded("admins.read"),
      schema: {
        tags: ["Admin administrators"],
        summary: "Lista administradores sin exponer datos privados",
        security: adminSecurity,
        querystring: administratorsQuerySchema,
        response: {
          200: paginatedResponseSchema,
          ...commonAdminErrors,
        },
      },
    },
    controller.listAdministrators,
  );

  app.get(
    "/api/v1/admin/administrators/:adminId",
    {
      preHandler: guarded("admins.read"),
      schema: {
        tags: ["Admin administrators"],
        summary: "Consulta un administrador segun el alcance permitido",
        security: adminSecurity,
        params: adminResourceParamsSchema,
        response: {
          200: successResponseSchema,
          ...commonAdminErrors,
        },
      },
    },
    controller.getAdministrator,
  );

  app.post(
    "/api/v1/admin/users/:userId/promote",
    {
      preHandler: guarded("admins.promote"),
      schema: {
        tags: ["Admin administrators"],
        summary: "Promueve una cuenta normal a administrador",
        security: adminSecurity,
        params: adminResourceParamsSchema,
        body: reasonBodySchema,
        response: {
          200: successResponseSchema,
          ...commonAdminErrors,
        },
      },
    },
    controller.promoteUser,
  );

  for (const [action, permission, summary, handler] of [
    [
      "demote",
      "admins.demote",
      "Degrada un administrador a usuario",
      controller.demoteAdministrator,
    ],
    [
      "suspend",
      "admins.suspend",
      "Suspende una cuenta administrativa",
      controller.suspendAdministrator,
    ],
    [
      "reactivate",
      "admins.suspend",
      "Reactiva una cuenta administrativa",
      controller.reactivateAdministrator,
    ],
    [
      "revoke-sessions",
      "admins.update",
      "Revoca las sesiones administrativas de una cuenta",
      controller.revokeAdministratorSessions,
    ],
  ]) {
    app.post(
      `/api/v1/admin/administrators/:adminId/${action}`,
      {
        preHandler: guarded(permission),
        schema: {
          tags: ["Admin administrators"],
          summary,
          security: adminSecurity,
          params: adminResourceParamsSchema,
          body: reasonBodySchema,
          response: {
            200: successResponseSchema,
            ...commonAdminErrors,
          },
        },
      },
      handler,
    );
  }

  app.post(
    "/api/v1/admin-role-requests",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Admin role requests"],
        summary: "Solicita el rol de administrador para la cuenta propia",
        security: adminSecurity,
        body: roleRequestBodySchema,
        response: {
          201: successResponseSchema,
          ...commonAdminErrors,
        },
      },
    },
    controller.createOwnRoleRequest,
  );

  app.get(
    "/api/v1/admin-role-requests/me",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Admin role requests"],
        summary: "Lista las solicitudes administrativas propias",
        security: adminSecurity,
        querystring: roleRequestsQuerySchema,
        response: {
          200: paginatedResponseSchema,
          ...commonAdminErrors,
        },
      },
    },
    controller.listOwnRoleRequests,
  );

  app.delete(
    "/api/v1/admin-role-requests/:requestId",
    {
      preHandler: authenticate,
      schema: {
        tags: ["Admin role requests"],
        summary: "Cancela una solicitud propia pendiente",
        security: adminSecurity,
        params: adminResourceParamsSchema,
        response: {
          204: emptyResponseSchema,
          ...commonAdminErrors,
        },
      },
    },
    controller.cancelRoleRequest,
  );

  app.post(
    "/api/v1/admin/admin-role-requests",
    {
      preHandler: guarded("adminRequests.create"),
      schema: {
        tags: ["Admin role requests"],
        summary: "Recomienda a un usuario para el rol administrativo",
        security: adminSecurity,
        body: adminRecommendationBodySchema,
        response: {
          201: successResponseSchema,
          ...commonAdminErrors,
        },
      },
    },
    controller.createRecommendation,
  );

  app.get(
    "/api/v1/admin/admin-role-requests/mine",
    {
      preHandler: guarded("adminRequests.create"),
      schema: {
        tags: ["Admin role requests"],
        summary: "Lista las recomendaciones creadas por el administrador",
        security: adminSecurity,
        querystring: roleRequestsQuerySchema,
        response: {
          200: paginatedResponseSchema,
          ...commonAdminErrors,
        },
      },
    },
    controller.listOwnRoleRequests,
  );

  app.get(
    "/api/v1/admin/admin-role-requests",
    {
      preHandler: guarded("adminRequests.read"),
      schema: {
        tags: ["Admin role requests"],
        summary: "Lista todas las solicitudes administrativas",
        security: adminSecurity,
        querystring: roleRequestsQuerySchema,
        response: {
          200: paginatedResponseSchema,
          ...commonAdminErrors,
        },
      },
    },
    controller.listRoleRequests,
  );

  app.get(
    "/api/v1/admin/admin-role-requests/:requestId",
    {
      preHandler: guarded("adminRequests.read"),
      schema: {
        tags: ["Admin role requests"],
        summary: "Consulta una solicitud administrativa",
        security: adminSecurity,
        params: adminResourceParamsSchema,
        response: {
          200: successResponseSchema,
          ...commonAdminErrors,
        },
      },
    },
    controller.getRoleRequest,
  );

  for (const [action, summary, handler] of [
    [
      "approve",
      "Aprueba la solicitud y promueve al candidato",
      controller.approveRoleRequest,
    ],
    [
      "reject",
      "Rechaza una solicitud administrativa",
      controller.rejectRoleRequest,
    ],
  ]) {
    app.post(
      `/api/v1/admin/admin-role-requests/:requestId/${action}`,
      {
        preHandler: guarded("adminRequests.resolve"),
        schema: {
          tags: ["Admin role requests"],
          summary,
          security: adminSecurity,
          params: adminResourceParamsSchema,
          body: reasonBodySchema,
          response: {
            200: successResponseSchema,
            ...commonAdminErrors,
          },
        },
      },
      handler,
    );
  }

  app.post(
    "/api/v1/admin/admin-role-requests/:requestId/request-information",
    {
      preHandler: guarded("adminRequests.resolve"),
      schema: {
        tags: ["Admin role requests"],
        summary: "Solicita informacion adicional sin resolver la solicitud",
        security: adminSecurity,
        params: adminResourceParamsSchema,
        body: reasonBodySchema,
        response: {
          200: successResponseSchema,
          ...commonAdminErrors,
        },
      },
    },
    controller.requestRoleInformation,
  );

  app.get(
    "/api/v1/admin/audit",
    {
      preHandler: guarded("audit.readOwn"),
      schema: {
        tags: ["Admin audit"],
        summary: "Consulta la auditoria segun el alcance del administrador",
        security: adminSecurity,
        querystring: auditQuerySchema,
        response: {
          200: paginatedResponseSchema,
          ...commonAdminErrors,
        },
      },
    },
    controller.listAudit,
  );

  app.get(
    "/api/v1/admin/settings",
    {
      preHandler: guarded("settings.read"),
      schema: {
        tags: ["Admin settings"],
        summary: "Consulta parametros operativos administrables",
        security: adminSecurity,
        response: {
          200: successResponseSchema,
          ...commonAdminErrors,
        },
      },
    },
    controller.listSettings,
  );

  app.patch(
    "/api/v1/admin/settings",
    {
      preHandler: guarded("settings.update"),
      schema: {
        tags: ["Admin settings"],
        summary: "Actualiza un parametro operativo permitido",
        security: adminSecurity,
        body: updateSettingBodySchema,
        response: {
          200: successResponseSchema,
          ...commonAdminErrors,
        },
      },
    },
    controller.updateSetting,
  );
}
