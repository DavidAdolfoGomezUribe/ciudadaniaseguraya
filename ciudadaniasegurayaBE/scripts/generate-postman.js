import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const postmanDirectory = resolve(rootDirectory, "postman");

function event(listen, script) {
  return {
    listen,
    script: {
      type: "text/javascript",
      exec: script.trim().split("\n"),
    },
  };
}

function saveSession(tokenVariable, userVariable) {
  return `
const payload = pm.response.json();
if (payload?.data?.accessToken) {
  pm.environment.set("${tokenVariable}", payload.data.accessToken);
}
if (payload?.data?.user?.id) {
  pm.environment.set("${userVariable}", payload.data.user.id);
}`.trim();
}

function saveId(variableName) {
  return `
const payload = pm.response.json();
if (payload?.data?.id) {
  pm.environment.set("${variableName}", payload.data.id);
}`.trim();
}

function saveFirstId(variableName) {
  return `
const payload = pm.response.json();
if (payload?.data?.[0]?.id) {
  pm.environment.set("${variableName}", payload.data[0].id);
}`.trim();
}

const saveIncidentForModeration = `
const payload = pm.response.json();
const incident = Array.isArray(payload?.data) ? payload.data[0] : payload?.data;
if (incident?.id) {
  pm.environment.set("incidentId", incident.id);
}
if (incident?.updatedAt) {
  pm.environment.set("incidentExpectedUpdatedAt", incident.updatedAt);
}`.trim();

function expectStatus(status) {
  return `
pm.test("Responde ${status}", function () {
  pm.response.to.have.status(${status});
});`.trim();
}

function auth(type) {
  if (type === "none") {
    return { type: "noauth" };
  }

  const tokenByType = {
    user: "{{accessToken}}",
    admin: "{{adminAccessToken}}",
    superadmin: "{{superadminAccessToken}}",
  };

  return {
    type: "bearer",
    bearer: [
      {
        key: "token",
        type: "string",
        value: tokenByType[type],
      },
    ],
  };
}

function request(
  name,
  method,
  path,
  {
    authorization = "none",
    body,
    description,
    headers = [],
    preRequest,
    tests,
  } = {},
) {
  const item = {
    name,
    request: {
      method,
      header: [
        ...headers,
        ...(body === undefined
          ? []
          : [
              {
                key: "Content-Type",
                value: "application/json",
                type: "text",
              },
            ]),
      ],
      auth: auth(authorization),
      url: `{{baseUrl}}${path}`,
    },
  };

  if (description) {
    item.request.description = description;
  }

  if (body !== undefined) {
    item.request.body = {
      mode: "raw",
      raw: JSON.stringify(body, null, 2),
      options: { raw: { language: "json" } },
    };
  }

  const events = [];
  if (preRequest) {
    events.push(event("prerequest", preRequest));
  }
  if (tests) {
    events.push(event("test", tests));
  }
  if (events.length > 0) {
    item.event = events;
  }

  return item;
}

const publicFolders = [
  {
    name: "Health",
    item: [
      request("Health", "GET", "/health"),
      request("Ready", "GET", "/ready"),
      request("OpenAPI JSON", "GET", "/docs/json"),
    ],
  },
  {
    name: "Auth",
    item: [
      request("Register", "POST", "/api/v1/auth/register", {
        body: {
          email: "{{email}}",
          username: "{{username}}",
          password: "{{password}}",
        },
        preRequest: `
const suffix = Date.now();
pm.environment.set("email", \`postman_\${suffix}@example.test\`);
pm.environment.set("username", \`postman_\${suffix}\`);`,
        tests: saveSession("accessToken", "normalUserId"),
      }),
      request("Login", "POST", "/api/v1/auth/login", {
        body: {
          identifier: "{{email}}",
          password: "{{password}}",
        },
        tests: saveSession("accessToken", "normalUserId"),
      }),
      request("Google login", "POST", "/api/v1/auth/google", {
        body: { credential: "{{googleCredential}}" },
        tests: saveSession("accessToken", "normalUserId"),
      }),
      request("Link Google", "POST", "/api/v1/auth/google/link", {
        authorization: "user",
        body: { credential: "{{googleCredential}}" },
      }),
      request("Refresh", "POST", "/api/v1/auth/refresh", {
        tests: saveSession("accessToken", "normalUserId"),
      }),
      request("Logout", "POST", "/api/v1/auth/logout"),
      request("Logout all", "POST", "/api/v1/auth/logout-all", {
        authorization: "user",
      }),
      request("Me", "GET", "/api/v1/auth/me", {
        authorization: "user",
      }),
    ],
  },
  {
    name: "Users",
    item: [
      request(
        "Public profile",
        "GET",
        "/api/v1/users/{{normalUserId}}",
      ),
      request("Update my profile", "PATCH", "/api/v1/users/me", {
        authorization: "user",
        body: { displayName: "Perfil de prueba Postman" },
      }),
      request("Delete my account", "DELETE", "/api/v1/users/me", {
        authorization: "user",
      }),
    ],
  },
  {
    name: "Incidents",
    item: [
      request("Incident types", "GET", "/api/v1/incidents/types"),
      request("Create report", "POST", "/api/v1/incidents/reports", {
        authorization: "user",
        body: {
          cityId: "{{cityId}}",
          incidentType: "robo",
          title: "Robo en transporte publico",
          description: "Descripcion de prueba con detalle verificable.",
          occurredAt: "2026-07-26T18:30:00.000Z",
          latitude: 4.711,
          longitude: -74.0721,
          locationPrecision: "approximate",
          address: "Direccion aproximada",
          neighborhood: "Barrio de prueba",
          evidenceDescription: "Evidencia descrita para la prueba",
        },
        tests: saveIncidentForModeration,
      }),
      request(
        "List incidents",
        "GET",
        "/api/v1/incidents?cityId={{cityId}}&page=1&pageSize=20",
      ),
      request(
        "Nearby incidents",
        "GET",
        "/api/v1/incidents/nearby?cityId={{cityId}}&latitude=4.711&longitude=-74.0721&radiusMeters=2000",
      ),
      request("Get incident", "GET", "/api/v1/incidents/{{incidentId}}"),
      request(
        "Update owned incident",
        "PATCH",
        "/api/v1/incidents/{{incidentId}}",
        {
          authorization: "user",
          body: { description: "Descripcion ciudadana actualizada." },
        },
      ),
      request(
        "Confirm incident",
        "POST",
        "/api/v1/incidents/{{incidentId}}/confirm",
        { authorization: "user" },
      ),
      request(
        "Remove confirmation",
        "DELETE",
        "/api/v1/incidents/{{incidentId}}/confirm",
        { authorization: "user" },
      ),
      request(
        "Delete owned incident",
        "DELETE",
        "/api/v1/incidents/{{incidentId}}",
        { authorization: "user" },
      ),
    ],
  },
  {
    name: "Geolocation",
    item: [
      request("List cities", "GET", "/api/v1/geolocation/cities", {
        tests: saveFirstId("cityId"),
      }),
      request("Map configuration", "GET", "/api/v1/geolocation/config"),
      request(
        "Calculate cell",
        "GET",
        "/api/v1/geolocation/cell?latitude=4.711&longitude=-74.0721&resolution=9",
      ),
      request(
        "Annual heatmap viewport",
        "GET",
        "/api/v1/geolocation/heatmap?cityId={{cityId}}&resolution=9&north=4.9&south=4.4&east=-73.8&west=-74.4",
      ),
      request(
        "Annual hexagon detail",
        "GET",
        "/api/v1/geolocation/hexagons/8966e42888fffff?cityId={{cityId}}",
      ),
    ],
  },
  {
    name: "Statistics",
    item: [
      request(
        "Overview",
        "GET",
        "/api/v1/statistics/overview?cityId={{cityId}}",
      ),
      request(
        "Timeseries",
        "GET",
        "/api/v1/statistics/timeseries?cityId={{cityId}}&groupBy=month",
      ),
      request(
        "Hourly",
        "GET",
        "/api/v1/statistics/hourly?cityId={{cityId}}",
      ),
      request(
        "Types",
        "GET",
        "/api/v1/statistics/types?cityId={{cityId}}",
      ),
    ],
  },
  {
    name: "Forum Posts",
    item: [
      request("Create post", "POST", "/api/v1/posts", {
        authorization: "user",
        body: {
          title: "Alerta de seguridad en el barrio",
          content: "Informacion comunitaria detallada para una prueba.",
          tags: ["seguridad", "barrio"],
          relatedIncidentId: "{{incidentId}}",
        },
        tests: saveId("postId"),
      }),
      request("List posts", "GET", "/api/v1/posts?page=1&pageSize=20"),
      request("Get post", "GET", "/api/v1/posts/{{postId}}"),
      request("Update post", "PATCH", "/api/v1/posts/{{postId}}", {
        authorization: "user",
        body: { title: "Alerta de seguridad actualizada" },
      }),
      request("Delete post", "DELETE", "/api/v1/posts/{{postId}}", {
        authorization: "user",
      }),
    ],
  },
  {
    name: "Comments",
    item: [
      request(
        "Create comment",
        "POST",
        "/api/v1/posts/{{postId}}/comments",
        {
          authorization: "user",
          body: { content: "Gracias por compartir esta informacion." },
          tests: saveId("commentId"),
        },
      ),
      request(
        "List comments",
        "GET",
        "/api/v1/posts/{{postId}}/comments?page=1&pageSize=50",
      ),
      request(
        "Update comment",
        "PATCH",
        "/api/v1/comments/{{commentId}}",
        {
          authorization: "user",
          body: { content: "Comentario actualizado." },
        },
      ),
      request(
        "Delete comment",
        "DELETE",
        "/api/v1/comments/{{commentId}}",
        { authorization: "user" },
      ),
    ],
  },
  {
    name: "Reactions",
    item: [
      request(
        "React to post",
        "POST",
        "/api/v1/posts/{{postId}}/reactions",
        {
          authorization: "user",
          body: { reactionType: "helpful" },
        },
      ),
      request(
        "Remove post reaction",
        "DELETE",
        "/api/v1/posts/{{postId}}/reactions/helpful",
        { authorization: "user" },
      ),
      request(
        "React to comment",
        "POST",
        "/api/v1/comments/{{commentId}}/reactions",
        {
          authorization: "user",
          body: { reactionType: "like" },
        },
      ),
      request(
        "Remove comment reaction",
        "DELETE",
        "/api/v1/comments/{{commentId}}/reactions/like",
        { authorization: "user" },
      ),
    ],
  },
  {
    name: "Realtime",
    item: [
      request(
        "Public SSE",
        "GET",
        "/api/v1/events/stream?clientId=postman-public-client",
        {
          headers: [{ key: "Accept", value: "text/event-stream" }],
          description:
            "Stream publico. No debe emitir eventos con prefijo admin.",
        },
      ),
    ],
  },
];

const adminFolders = [
  {
    name: "Admin Authentication",
    description:
      "Sesiones administrativas aisladas. Postman mantiene la cookie HttpOnly en su cookie jar; inicia una identidad a la vez para probar refresh/logout.",
    item: [
      request("Login admin", "POST", "/api/v1/admin/auth/login", {
        body: {
          identifier: "{{adminIdentifier}}",
          password: "{{adminPassword}}",
        },
        tests: saveSession("adminAccessToken", "adminUserId"),
      }),
      request("Login superadmin", "POST", "/api/v1/admin/auth/login", {
        body: {
          identifier: "{{superadminIdentifier}}",
          password: "{{superadminPassword}}",
        },
        tests: saveSession("superadminAccessToken", "superadminUserId"),
      }),
      request("Refresh current admin session", "POST", "/api/v1/admin/auth/refresh", {
        tests: saveSession("adminAccessToken", "adminUserId"),
      }),
      request("Admin me", "GET", "/api/v1/admin/auth/me", {
        authorization: "admin",
      }),
      request("Superadmin me", "GET", "/api/v1/admin/auth/me", {
        authorization: "superadmin",
      }),
      request("Logout current admin session", "POST", "/api/v1/admin/auth/logout"),
      request("Logout all own admin sessions", "POST", "/api/v1/admin/auth/logout-all", {
        authorization: "admin",
      }),
    ],
  },
  {
    name: "Admin Dashboard",
    item: [
      request("Dashboard", "GET", "/api/v1/admin/dashboard", {
        authorization: "admin",
      }),
    ],
  },
  {
    name: "Admin Users",
    item: [
      request(
        "List normal users",
        "GET",
        "/api/v1/admin/users?page=1&pageSize=25&sortBy=createdAt&sortOrder=desc",
        { authorization: "admin" },
      ),
      request(
        "Get normal user",
        "GET",
        "/api/v1/admin/users/{{normalUserId}}",
        { authorization: "admin" },
      ),
      request(
        "Update normal user",
        "PATCH",
        "/api/v1/admin/users/{{normalUserId}}",
        {
          authorization: "admin",
          body: {
            displayName: "Nombre corregido por administracion",
            reason: "Correccion solicitada y documentada por soporte.",
          },
        },
      ),
      request(
        "Suspend normal user",
        "POST",
        "/api/v1/admin/users/{{normalUserId}}/suspend",
        {
          authorization: "admin",
          body: {
            reason: "Suspension temporal por incumplimiento documentado.",
          },
        },
      ),
      request(
        "Reactivate normal user",
        "POST",
        "/api/v1/admin/users/{{normalUserId}}/reactivate",
        {
          authorization: "admin",
          body: {
            reason: "Revision completada; procede la reactivacion.",
          },
        },
      ),
      request(
        "Revoke normal user sessions",
        "POST",
        "/api/v1/admin/users/{{normalUserId}}/revoke-sessions",
        {
          authorization: "admin",
          body: {
            reason: "Revocacion preventiva solicitada por seguridad.",
          },
        },
      ),
      request(
        "Admin attempts to modify another admin - expect 403",
        "PATCH",
        "/api/v1/admin/users/{{adminUserId}}",
        {
          authorization: "admin",
          body: {
            displayName: "Cambio que debe ser rechazado",
            reason: "Prueba negativa de aislamiento entre administradores.",
          },
          tests: expectStatus(403),
        },
      ),
      request(
        "Logical delete normal user",
        "DELETE",
        "/api/v1/admin/users/{{normalUserId}}",
        {
          authorization: "admin",
          body: {
            reason: "Solicitud de eliminacion validada por administracion.",
            confirmation: "ELIMINAR",
          },
          description:
            "Accion destructiva logica: ejecutala al final del flujo de prueba.",
        },
      ),
    ],
  },
  {
    name: "Administrators",
    item: [
      request(
        "List administrators",
        "GET",
        "/api/v1/admin/administrators?page=1&pageSize=25",
        { authorization: "admin" },
      ),
      request(
        "Get administrator",
        "GET",
        "/api/v1/admin/administrators/{{adminUserId}}",
        { authorization: "admin" },
      ),
      request(
        "Admin attempts to promote user - expect 403",
        "POST",
        "/api/v1/admin/users/{{normalUserId}}/promote",
        {
          authorization: "admin",
          body: {
            reason: "Prueba negativa: un admin no puede asignar autoridad.",
          },
          tests: expectStatus(403),
        },
      ),
      request(
        "Superadmin promotes user",
        "POST",
        "/api/v1/admin/users/{{normalUserId}}/promote",
        {
          authorization: "superadmin",
          body: {
            reason: "Promocion aprobada tras revisar experiencia y solicitud.",
          },
        },
      ),
      request(
        "Superadmin demotes administrator",
        "POST",
        "/api/v1/admin/administrators/{{adminUserId}}/demote",
        {
          authorization: "superadmin",
          body: {
            reason: "Revocacion de funciones administrativas documentada.",
          },
        },
      ),
      request(
        "Superadmin suspends administrator",
        "POST",
        "/api/v1/admin/administrators/{{adminUserId}}/suspend",
        {
          authorization: "superadmin",
          body: {
            reason: "Suspension administrativa durante una investigacion.",
          },
        },
      ),
      request(
        "Superadmin reactivates administrator",
        "POST",
        "/api/v1/admin/administrators/{{adminUserId}}/reactivate",
        {
          authorization: "superadmin",
          body: {
            reason: "Investigacion cerrada y acceso autorizado nuevamente.",
          },
        },
      ),
      request(
        "Superadmin revokes administrator sessions",
        "POST",
        "/api/v1/admin/administrators/{{adminUserId}}/revoke-sessions",
        {
          authorization: "superadmin",
          body: {
            reason: "Rotacion preventiva de todas las sesiones administrativas.",
          },
        },
      ),
    ],
  },
  {
    name: "Admin Role Requests",
    item: [
      request(
        "Normal user requests admin role",
        "POST",
        "/api/v1/admin-role-requests",
        {
          authorization: "user",
          body: {
            motivation:
              "Deseo colaborar con la moderacion y cuento con disponibilidad para revisar reportes comunitarios.",
            experience:
              "Experiencia verificable en gestion comunitaria y protocolos de atencion.",
          },
          tests: saveId("adminRequestId"),
        },
      ),
      request(
        "Normal user lists own requests",
        "GET",
        "/api/v1/admin-role-requests/me?page=1&pageSize=25",
        { authorization: "user" },
      ),
      request(
        "Normal user cancels pending request",
        "DELETE",
        "/api/v1/admin-role-requests/{{adminRequestId}}",
        { authorization: "user" },
      ),
      request(
        "Admin recommends normal user",
        "POST",
        "/api/v1/admin/admin-role-requests",
        {
          authorization: "admin",
          body: {
            candidateUserId: "{{normalUserId}}",
            motivation:
              "Recomiendo al usuario por su trayectoria consistente apoyando a la comunidad.",
            experience:
              "Ha colaborado en procesos de verificacion y mediacion comunitaria.",
          },
          tests: saveId("adminRequestId"),
        },
      ),
      request(
        "Admin lists own recommendations",
        "GET",
        "/api/v1/admin/admin-role-requests/mine?page=1&pageSize=25",
        { authorization: "admin" },
      ),
      request(
        "Superadmin lists all requests",
        "GET",
        "/api/v1/admin/admin-role-requests?status=pending&page=1&pageSize=25&sortOrder=asc",
        {
          authorization: "superadmin",
          tests: saveFirstId("adminRequestId"),
        },
      ),
      request(
        "Superadmin gets request",
        "GET",
        "/api/v1/admin/admin-role-requests/{{adminRequestId}}",
        { authorization: "superadmin" },
      ),
      request(
        "Superadmin requests additional information",
        "POST",
        "/api/v1/admin/admin-role-requests/{{adminRequestId}}/request-information",
        {
          authorization: "superadmin",
          body: {
            reason:
              "Adjunta referencias adicionales sobre la experiencia indicada.",
          },
          description:
            "Registra la solicitud de informacion sin resolver la candidatura.",
        },
      ),
      request(
        "Superadmin approves request",
        "POST",
        "/api/v1/admin/admin-role-requests/{{adminRequestId}}/approve",
        {
          authorization: "superadmin",
          body: {
            reason: "Solicitud aprobada tras completar la evaluacion requerida.",
          },
        },
      ),
      request(
        "Superadmin rejects request",
        "POST",
        "/api/v1/admin/admin-role-requests/{{adminRequestId}}/reject",
        {
          authorization: "superadmin",
          body: {
            reason: "La solicitud no cumple todavia los criterios documentados.",
          },
        },
      ),
    ],
  },
  {
    name: "Incident Moderation",
    item: [
      request(
        "List pending incidents oldest first",
        "GET",
        "/api/v1/admin/incidents?status=pending&page=1&pageSize=25&sortBy=createdAt&sortOrder=asc",
        {
          authorization: "admin",
          tests: saveIncidentForModeration,
        },
      ),
      request(
        "Get incident moderation detail",
        "GET",
        "/api/v1/admin/incidents/{{incidentId}}",
        {
          authorization: "admin",
          tests: saveIncidentForModeration,
        },
      ),
      request(
        "Claim review lock",
        "POST",
        "/api/v1/admin/incidents/{{incidentId}}/review-lock",
        {
          authorization: "admin",
          body: {
            expectedUpdatedAt: "{{incidentExpectedUpdatedAt}}",
            ttlSeconds: 900,
          },
          tests: saveIncidentForModeration,
        },
      ),
      request(
        "Update incident with optimistic version",
        "PATCH",
        "/api/v1/admin/incidents/{{incidentId}}",
        {
          authorization: "admin",
          body: {
            title: "Titulo corregido durante la revision",
            reason: "Correccion sustentada por la fuente revisada.",
            expectedUpdatedAt: "{{incidentExpectedUpdatedAt}}",
          },
          tests: saveIncidentForModeration,
        },
      ),
      request(
        "Admin approves incident",
        "POST",
        "/api/v1/admin/incidents/{{incidentId}}/approve",
        {
          authorization: "admin",
          body: {
            reason: "Fuentes revisadas; el incidente puede validarse.",
            sourceUrls: ["https://example.test/fuente-incidente"],
            corrections: {},
            expectedUpdatedAt: "{{incidentExpectedUpdatedAt}}",
          },
          tests: saveIncidentForModeration,
        },
      ),
      request(
        "Admin rejects incident",
        "POST",
        "/api/v1/admin/incidents/{{incidentId}}/reject",
        {
          authorization: "admin",
          body: {
            reasonCode: "insufficient_evidence",
            reason: "No existe evidencia suficiente para validar el reporte.",
            expectedUpdatedAt: "{{incidentExpectedUpdatedAt}}",
          },
          tests: saveIncidentForModeration,
        },
      ),
      request(
        "Release review lock",
        "DELETE",
        "/api/v1/admin/incidents/{{incidentId}}/review-lock",
        {
          authorization: "admin",
          body: {
            expectedUpdatedAt: "{{incidentExpectedUpdatedAt}}",
            reason: "Revision finalizada; se libera el bloqueo temporal.",
          },
          tests: saveIncidentForModeration,
        },
      ),
      request(
        "Merge duplicate incident",
        "POST",
        "/api/v1/admin/incidents/{{incidentId}}/merge",
        {
          authorization: "admin",
          body: {
            secondaryIncidentId: "{{secondaryIncidentId}}",
            reason: "Los dos registros describen el mismo hecho verificado.",
            expectedUpdatedAt: "{{incidentExpectedUpdatedAt}}",
            secondaryExpectedUpdatedAt: "{{secondaryExpectedUpdatedAt}}",
          },
        },
      ),
      request(
        "Create verified incident",
        "POST",
        "/api/v1/admin/incidents",
        {
          authorization: "admin",
          body: {
            cityId: "{{cityId}}",
            incidentType: "vandalismo",
            title: "Incidente verificado por administracion",
            description: "Descripcion respaldada por una fuente administrativa.",
            occurredAt: "2026-07-26T18:30:00.000Z",
            latitude: 4.711,
            longitude: -74.0721,
            locationPrecision: "approximate",
            sourceUrl: "https://example.test/fuente-administrativa",
          },
          tests: saveIncidentForModeration,
        },
      ),
    ],
  },
  {
    name: "Post Moderation",
    item: [
      request(
        "List posts for moderation",
        "GET",
        "/api/v1/admin/posts?page=1&pageSize=25&sortBy=createdAt&sortOrder=desc",
        { authorization: "admin" },
      ),
      request(
        "Get post moderation detail",
        "GET",
        "/api/v1/admin/posts/{{postId}}",
        { authorization: "admin" },
      ),
      request(
        "Edit post as moderator",
        "PATCH",
        "/api/v1/admin/posts/{{postId}}",
        {
          authorization: "admin",
          body: {
            title: "Titulo corregido por moderacion",
            reason: "Se corrige el titulo para retirar informacion sensible.",
          },
        },
      ),
      request(
        "Compatibility - set post status",
        "PATCH",
        "/api/v1/admin/posts/{{postId}}/status",
        {
          authorization: "admin",
          body: {
            status: "hidden",
            reason: "Compatibilidad temporal con el cliente administrativo anterior.",
          },
          description:
            "Ruta heredada. Para clientes nuevos usa hide o restore.",
        },
      ),
      request(
        "Hide post",
        "POST",
        "/api/v1/admin/posts/{{postId}}/hide",
        {
          authorization: "admin",
          body: {
            reason: "La publicacion incumple las reglas de contenido vigentes.",
          },
        },
      ),
      request(
        "Restore post",
        "POST",
        "/api/v1/admin/posts/{{postId}}/restore",
        {
          authorization: "admin",
          body: {
            reason: "La revision confirma que el contenido puede restaurarse.",
          },
        },
      ),
      request(
        "Logical delete post",
        "DELETE",
        "/api/v1/admin/posts/{{postId}}",
        {
          authorization: "admin",
          body: {
            reason: "Eliminacion logica por una infraccion grave documentada.",
          },
        },
      ),
    ],
  },
  {
    name: "Comment Moderation",
    item: [
      request(
        "List comments for moderation",
        "GET",
        "/api/v1/admin/comments?page=1&pageSize=25&sortBy=createdAt&sortOrder=desc",
        { authorization: "admin" },
      ),
      request(
        "Get comment moderation detail",
        "GET",
        "/api/v1/admin/comments/{{commentId}}",
        { authorization: "admin" },
      ),
      request(
        "Edit comment as moderator",
        "PATCH",
        "/api/v1/admin/comments/{{commentId}}",
        {
          authorization: "admin",
          body: {
            content: "Comentario corregido sin informacion personal.",
            reason: "Se retiran datos personales expuestos en el comentario.",
          },
        },
      ),
      request(
        "Compatibility - set comment status",
        "PATCH",
        "/api/v1/admin/comments/{{commentId}}/status",
        {
          authorization: "admin",
          body: {
            status: "hidden",
            reason: "Compatibilidad temporal con el cliente administrativo anterior.",
          },
          description:
            "Ruta heredada. Para clientes nuevos usa hide o restore.",
        },
      ),
      request(
        "Hide comment",
        "POST",
        "/api/v1/admin/comments/{{commentId}}/hide",
        {
          authorization: "admin",
          body: {
            reason: "El comentario incumple las reglas de convivencia.",
          },
        },
      ),
      request(
        "Restore comment",
        "POST",
        "/api/v1/admin/comments/{{commentId}}/restore",
        {
          authorization: "admin",
          body: {
            reason: "La apelacion fue revisada y procede la restauracion.",
          },
        },
      ),
      request(
        "Logical delete comment",
        "DELETE",
        "/api/v1/admin/comments/{{commentId}}",
        {
          authorization: "admin",
          body: {
            reason: "Eliminacion logica por contenido prohibido documentado.",
          },
        },
      ),
    ],
  },
  {
    name: "Audit",
    item: [
      request(
        "Admin reads own audit",
        "GET",
        "/api/v1/admin/audit?page=1&pageSize=25",
        {
          authorization: "admin",
          description:
            "El backend limita un admin a su alcance audit.readOwn.",
        },
      ),
      request(
        "Superadmin reads all audit",
        "GET",
        "/api/v1/admin/audit?page=1&pageSize=25",
        {
          authorization: "superadmin",
          description:
            "Puede filtrar actorUserId, role, action, resourceType, requestId, from y to.",
        },
      ),
    ],
  },
  {
    name: "Admin Settings",
    item: [
      request("Superadmin lists settings", "GET", "/api/v1/admin/settings", {
        authorization: "superadmin",
      }),
      request("Superadmin updates setting", "PATCH", "/api/v1/admin/settings", {
        authorization: "superadmin",
        body: {
          key: "incidentConfirmationThreshold",
          value: 3,
          reason: "Ajuste operativo aprobado para el entorno de prueba.",
        },
      }),
    ],
  },
  {
    name: "Admin Realtime",
    item: [
      request(
        "Protected admin SSE",
        "GET",
        "/api/v1/admin/events/stream?clientId=postman-admin-client",
        {
          authorization: "admin",
          headers: [{ key: "Accept", value: "text/event-stream" }],
          description:
            "Stream protegido de eventos admin.*. Mantiene la respuesta abierta.",
        },
      ),
    ],
  },
];

const collection = {
  info: {
    name: "ciudadaniasegurayaBE",
    description:
      "Coleccion local completa de la API publica y del panel administrativo aislado. No contiene credenciales reales.",
    schema:
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
  },
  item: [...publicFolders, ...adminFolders],
};

const environment = {
  name: "ciudadaniasegurayaBE local",
  values: [
    { key: "baseUrl", value: "http://localhost:3010", enabled: true },
    { key: "email", value: "", enabled: true },
    { key: "username", value: "", enabled: true },
    {
      key: "password",
      value: "Clave-Postman-Solo-Desarrollo-2026",
      enabled: true,
      type: "secret",
    },
    { key: "googleCredential", value: "", enabled: true, type: "secret" },
    { key: "accessToken", value: "", enabled: true, type: "secret" },
    { key: "adminIdentifier", value: "", enabled: true },
    { key: "adminPassword", value: "", enabled: true, type: "secret" },
    { key: "superadminIdentifier", value: "", enabled: true },
    { key: "superadminPassword", value: "", enabled: true, type: "secret" },
    { key: "adminAccessToken", value: "", enabled: true, type: "secret" },
    {
      key: "superadminAccessToken",
      value: "",
      enabled: true,
      type: "secret",
    },
    { key: "adminUserId", value: "", enabled: true },
    { key: "superadminUserId", value: "", enabled: true },
    { key: "normalUserId", value: "", enabled: true },
    { key: "cityId", value: "", enabled: true },
    { key: "incidentId", value: "", enabled: true },
    { key: "incidentExpectedUpdatedAt", value: "", enabled: true },
    { key: "secondaryIncidentId", value: "", enabled: true },
    { key: "secondaryExpectedUpdatedAt", value: "", enabled: true },
    { key: "adminRequestId", value: "", enabled: true },
    { key: "postId", value: "", enabled: true },
    { key: "commentId", value: "", enabled: true },
  ],
  _postman_variable_scope: "environment",
  _postman_exported_using: "ciudadaniasegurayaBE generator",
};

await mkdir(postmanDirectory, { recursive: true });
await Promise.all([
  writeFile(
    resolve(
      postmanDirectory,
      "ciudadaniasegurayaBE.postman_collection.json",
    ),
    `${JSON.stringify(collection, null, 2)}\n`,
  ),
  writeFile(
    resolve(
      postmanDirectory,
      "ciudadaniasegurayaBE.local.postman_environment.json",
    ),
    `${JSON.stringify(environment, null, 2)}\n`,
  ),
]);

console.info("Coleccion y environment de Postman generados.");
