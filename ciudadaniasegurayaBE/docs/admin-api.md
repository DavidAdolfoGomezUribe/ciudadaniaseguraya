# API administrativa

Esta guía describe el acceso y la operación del panel administrativo de
Ciudadanía Segura Ya. La autorización real se aplica en el backend mediante
permisos; el frontend solo usa esos permisos para presentar controles.

## Preparación local

Requisitos:

- MongoDB disponible.
- Variables generales descritas en `README.md`.
- Origen del frontend incluido en `CORS_ORIGINS`.
- Secretos JWT distintos por ambiente.

Variables del bootstrap:

```env
SUPERADMIN_EMAIL=
SUPERADMIN_USERNAME=
SUPERADMIN_PASSWORD=
SUPERADMIN_DISPLAY_NAME=
```

Controles del login administrativo:

```env
ADMIN_AUTH_RATE_LIMIT_MAX=5
ADMIN_AUTH_RATE_LIMIT_WINDOW_MS=300000
```

No uses `ADMIN_EMAIL`, `ADMIN_USERNAME` o `ADMIN_PASSWORD` para la cuenta
principal. Nunca expongas variables `SUPERADMIN_*` en el frontend ni les
agregues el prefijo `NEXT_PUBLIC_`.

Inicializa y crea la cuenta:

```bash
pnpm install --frozen-lockfile
pnpm db:init
pnpm db:seed:superadmin
pnpm dev
```

El seed es idempotente, normaliza email/username, usa Argon2id y marca
`adminMetadata.isBootstrapSuperadmin`. No imprime la contraseña. El backend
ejecuta la misma sincronización al arrancar: con las tres credenciales vacías
conserva la cuenta existente, con los mismos valores no escribe nada y con
valores distintos actualiza el superadmin existente. Las tres credenciales
obligatorias deben definirse juntas. Mantén `SUPERADMIN_PASSWORD` como secreto
del entorno de despliegue y nunca lo expongas al frontend.

URLs locales:

- API: `http://localhost:3010`
- Swagger: `http://localhost:3010/docs`
- OpenAPI: `http://localhost:3010/docs/json`
- Frontend administrativo: `http://localhost:3001/login/admin`

## Sesión administrativa aislada

El login público y el administrativo no son intercambiables:

| Sesión | Login | Access | Refresh |
| --- | --- | --- | --- |
| Pública | `/api/v1/auth/login` | Bearer público | `csy_refresh` |
| Administrativa | `/api/v1/admin/auth/login` | Bearer admin | `csy_admin_refresh` |

`csy_admin_refresh` es HttpOnly, usa los atributos `Secure`/`SameSite`
configurados y limita su `Path` a `/api/v1/admin/auth`. El access token se
devuelve en JSON para mantenerse únicamente en memoria del cliente admin.

Login:

```http
POST /api/v1/admin/auth/login
Content-Type: application/json

{
  "identifier": "identificador-configurado-localmente",
  "password": "valor-configurado-localmente"
}
```

Solo `admin` y `superadmin` completan el flujo. Un usuario normal recibe un
error genérico sin revelar roles internos. Los fallos usan retraso progresivo,
bloqueo temporal y rate limit independiente; la auditoría nunca almacena la
contraseña ni el identificador en claro.

Rutas de sesión:

| Método | Ruta | Requisito | Resultado |
| --- | --- | --- | --- |
| POST | `/api/v1/admin/auth/login` | Credenciales admin | Access, usuario y permisos |
| POST | `/api/v1/admin/auth/refresh` | Cookie admin | Rotación y access nuevo |
| POST | `/api/v1/admin/auth/logout` | Cookie admin | `204` y revocación actual |
| POST | `/api/v1/admin/auth/logout-all` | Bearer admin | `204` y revocación propia total |
| GET | `/api/v1/admin/auth/me` | Bearer admin | Identidad y permisos efectivos |

En producción se recomienda MFA para todo admin y debe considerarse
obligatorio para el superadmin en la siguiente fase de seguridad.

## Matriz de permisos

| Permiso | User | Admin | Superadmin |
| --- | :---: | :---: | :---: |
| `admin.dashboard.read` | — | ✓ | ✓ |
| `users.read` | — | ✓ | ✓ |
| `users.update` | — | ✓ | ✓ |
| `users.suspend` | — | ✓ | ✓ |
| `users.delete` | — | ✓ | ✓ |
| `admins.read` | — | ✓ | ✓ |
| `admins.update` | — | — | ✓ |
| `admins.promote` | — | — | ✓ |
| `admins.demote` | — | — | ✓ |
| `admins.suspend` | — | — | ✓ |
| `adminRequests.create` | ✓ | ✓ | ✓ |
| `adminRequests.read` | — | — | ✓ |
| `adminRequests.resolve` | — | — | ✓ |
| `incidents.read` | — | ✓ | ✓ |
| `incidents.createVerified` | — | ✓ | ✓ |
| `incidents.approve` | — | ✓ | ✓ |
| `incidents.reject` | — | ✓ | ✓ |
| `incidents.update` | — | ✓ | ✓ |
| `incidents.merge` | — | ✓ | ✓ |
| `posts.moderate` | — | ✓ | ✓ |
| `comments.moderate` | — | ✓ | ✓ |
| `audit.readOwn` | — | ✓ | ✓ |
| `audit.readAll` | — | — | ✓ |
| `settings.read` | — | — | ✓ |
| `settings.update` | — | — | ✓ |
| `sessions.revoke` | — | ✓ | ✓ |

Un admin puede consultar una ficha limitada de otros administradores, pero no
modificarlos. Solo el superadmin asigna o retira autoridad. Ninguna ruta común
crea otro superadmin ni cambia `isBootstrapSuperadmin`.

## Convenciones

Las rutas protegidas usan:

```http
Authorization: Bearer ADMIN_ACCESS_TOKEN
Content-Type: application/json
X-Request-Id: identificador-opcional
```

Listas: `page` inicia en `1`; `pageSize` no supera `100`. Respuesta:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 25,
    "total": 0,
    "totalPages": 0,
    "requestId": "request-id"
  }
}
```

Errores relevantes:

- `401 ADMIN_AUTH_REQUIRED`: falta o no sirve la sesión admin.
- `403 INSUFFICIENT_ADMIN_PERMISSION`: el actor carece del permiso.
- `403`: cuenta suspendida, objetivo administrativo o acción autopeligrosa.
- `404`: recurso inexistente o no visible.
- `409`: versión desactualizada, bloqueo concurrente o transición inválida.
- `429`: demasiados intentos o solicitudes.

Ante `409`, vuelve a consultar el recurso; no repitas ciegamente la mutación.

## Dashboard y usuarios

| Método | Ruta | Permiso |
| --- | --- | --- |
| GET | `/api/v1/admin/dashboard` | `admin.dashboard.read` |
| GET | `/api/v1/admin/users` | `users.read` |
| GET | `/api/v1/admin/users/:userId` | `users.read` |
| PATCH | `/api/v1/admin/users/:userId` | `users.update` |
| POST | `/api/v1/admin/users/:userId/suspend` | `users.suspend` |
| POST | `/api/v1/admin/users/:userId/reactivate` | `users.suspend` |
| POST | `/api/v1/admin/users/:userId/revoke-sessions` | `sessions.revoke` |
| DELETE | `/api/v1/admin/users/:userId` | `users.delete` |

Filtros de usuarios: `search`, `status`, `sortBy`, `sortOrder`, `page`,
`pageSize`.

Edición:

```json
{
  "displayName": "Nombre corregido",
  "reason": "Correccion solicitada y documentada por soporte."
}
```

Suspender, reactivar y revocar:

```json
{
  "reason": "Motivo administrativo de al menos diez caracteres."
}
```

Eliminación lógica:

```json
{
  "reason": "Solicitud de eliminacion validada por administracion.",
  "confirmation": "ELIMINAR"
}
```

La eliminación anonimiza la cuenta, revoca sesiones y marca su contenido
según las reglas del dominio. No elimina físicamente los registros de
auditoría.

## Administradores

| Método | Ruta | Permiso |
| --- | --- | --- |
| GET | `/api/v1/admin/administrators` | `admins.read` |
| GET | `/api/v1/admin/administrators/:adminId` | `admins.read` |
| POST | `/api/v1/admin/users/:userId/promote` | `admins.promote` |
| POST | `/api/v1/admin/administrators/:adminId/demote` | `admins.demote` |
| POST | `/api/v1/admin/administrators/:adminId/suspend` | `admins.suspend` |
| POST | `/api/v1/admin/administrators/:adminId/reactivate` | `admins.suspend` |
| POST | `/api/v1/admin/administrators/:adminId/revoke-sessions` | `admins.update` |

Todas las mutaciones reciben `{"reason":"..."}`. Promoción/degradación revoca
sesiones para que los permisos anteriores no sigan activos. El bootstrap
superadmin y la última autoridad activa están protegidos.
El listado acepta `search`, `status`, `page` y `pageSize`. La búsqueda cubre
`username` y `displayName`; para el superadmin también cubre el correo, que no
se expone ni permite inferir a un administrador de solo lectura.

## Solicitudes de rol

Flujo de usuario:

| Método | Ruta | Autorización |
| --- | --- | --- |
| POST | `/api/v1/admin-role-requests` | Bearer público |
| GET | `/api/v1/admin-role-requests/me` | Bearer público |
| DELETE | `/api/v1/admin-role-requests/:requestId` | Propietario y pendiente |

Solicitud:

```json
{
  "motivation": "Motivacion de al menos treinta caracteres.",
  "experience": "Experiencia relevante opcional."
}
```

Flujo administrativo:

| Método | Ruta | Permiso |
| --- | --- | --- |
| POST | `/api/v1/admin/admin-role-requests` | `adminRequests.create` |
| GET | `/api/v1/admin/admin-role-requests/mine` | `adminRequests.create` |
| GET | `/api/v1/admin/admin-role-requests` | `adminRequests.read` |
| GET | `/api/v1/admin/admin-role-requests/:requestId` | `adminRequests.read` |
| POST | `/api/v1/admin/admin-role-requests/:requestId/request-information` | `adminRequests.resolve` |
| POST | `/api/v1/admin/admin-role-requests/:requestId/approve` | `adminRequests.resolve` |
| POST | `/api/v1/admin/admin-role-requests/:requestId/reject` | `adminRequests.resolve` |

La recomendación agrega `candidateUserId`. Solicitar información, aprobar o
rechazar recibe `{"reason":"..."}`. `request-information` agrega el motivo al
historial sin cambiar el estado pendiente. La aprobación promueve al candidato
dentro de la misma operación lógica, resuelve la solicitud, revoca sesiones y
audita el cambio.

## Moderación de incidentes

| Método | Ruta | Permiso |
| --- | --- | --- |
| GET | `/api/v1/admin/incidents` | `incidents.read` |
| GET | `/api/v1/admin/incidents/:incidentId` | `incidents.read` |
| POST | `/api/v1/admin/incidents` | `incidents.createVerified` |
| PATCH | `/api/v1/admin/incidents/:incidentId` | `incidents.update` |
| POST | `/api/v1/admin/incidents/:incidentId/approve` | `incidents.approve` |
| POST | `/api/v1/admin/incidents/:incidentId/reject` | `incidents.reject` |
| POST | `/api/v1/admin/incidents/:incidentId/merge` | `incidents.merge` |
| POST | `/api/v1/admin/incidents/:incidentId/review-lock` | `incidents.update` |
| DELETE | `/api/v1/admin/incidents/:incidentId/review-lock` | `incidents.update` |

Cola recomendada:

```text
GET /api/v1/admin/incidents?status=pending&sortBy=createdAt&sortOrder=asc&page=1&pageSize=25
```

Filtros adicionales: `cityId`, `incidentType`, `from`, `to`,
`minConfirmations`, `source`, `possibleDuplicate`.

Reclamar una revisión:

```json
{
  "expectedUpdatedAt": "2026-07-29T12:00:00.000Z",
  "ttlSeconds": 900
}
```

Aprobar:

```json
{
  "reason": "Fuentes revisadas; el incidente puede validarse.",
  "sourceUrls": ["https://example.test/fuente-incidente"],
  "corrections": {},
  "expectedUpdatedAt": "2026-07-29T12:00:00.000Z"
}
```

Rechazar:

```json
{
  "reasonCode": "insufficient_evidence",
  "reason": "No existe evidencia suficiente para validar el reporte.",
  "expectedUpdatedAt": "2026-07-29T12:00:00.000Z"
}
```

Valores `reasonCode`: `insufficient_evidence`, `duplicate`,
`incorrect_location`, `incorrect_date`, `false_information`,
`outside_supported_area`, `prohibited_content`, `other`.

Fusionar:

```json
{
  "secondaryIncidentId": "OBJECT_ID",
  "reason": "Los dos registros describen el mismo hecho verificado.",
  "expectedUpdatedAt": "2026-07-29T12:00:00.000Z",
  "secondaryExpectedUpdatedAt": "2026-07-29T12:01:00.000Z"
}
```

La aprobación administrativa no requiere confirmaciones comunitarias, reclama
la estadística una sola vez y emite los eventos correspondientes. Rechazar no
incrementa estadísticas. Cambiar ubicación recalcula GeoJSON/H3.

## Moderación de contenido

Publicaciones:

| Método | Ruta |
| --- | --- |
| GET | `/api/v1/admin/posts` |
| GET | `/api/v1/admin/posts/:postId` |
| PATCH | `/api/v1/admin/posts/:postId` |
| POST | `/api/v1/admin/posts/:postId/hide` |
| POST | `/api/v1/admin/posts/:postId/restore` |
| DELETE | `/api/v1/admin/posts/:postId` |

Comentarios:

| Método | Ruta |
| --- | --- |
| GET | `/api/v1/admin/comments` |
| GET | `/api/v1/admin/comments/:commentId` |
| PATCH | `/api/v1/admin/comments/:commentId` |
| POST | `/api/v1/admin/comments/:commentId/hide` |
| POST | `/api/v1/admin/comments/:commentId/restore` |
| DELETE | `/api/v1/admin/comments/:commentId` |

Todas exigen `posts.moderate` o `comments.moderate`. Listas aceptan `search`,
`status`, autor y orden. Editar requiere el contenido permitido y `reason`;
ocultar, restaurar o borrar recibe `{"reason":"..."}`. El borrado es lógico.

`PATCH /api/v1/admin/posts/:postId/status` y
`PATCH /api/v1/admin/comments/:commentId/status` permanecen temporalmente por
compatibilidad; usa las acciones explícitas para clientes nuevos.

## Auditoría y configuración

| Método | Ruta | Permiso |
| --- | --- | --- |
| GET | `/api/v1/admin/audit` | `audit.readOwn` o `audit.readAll` |
| GET | `/api/v1/admin/settings` | `settings.read` |
| PATCH | `/api/v1/admin/settings` | `settings.update` |

Filtros de auditoría: `actorUserId`, `role`, `action`, `resourceType`,
`requestId`, `from`, `to`, `page`, `pageSize`. Un admin recibe solamente el
alcance permitido por `audit.readOwn`; un superadmin puede consultar todos los
actores. No existen endpoints administrativos para editar o borrar logs.

Ajuste:

```json
{
  "key": "incidentConfirmationThreshold",
  "value": 3,
  "reason": "Ajuste operativo aprobado para el entorno."
}
```

Claves permitidas: `incidentConfirmationThreshold` (2–20) e
`incidentMatchWindowMinutes` (1–10080).

## Tiempo real

```http
GET /api/v1/admin/events/stream?clientId=panel-admin-1
Accept: text/event-stream
Authorization: Bearer ADMIN_ACCESS_TOKEN
```

El stream admite `Last-Event-ID` o `lastEventId`, replay y heartbeat. Solo
publica eventos administrativos como actualizaciones de incidentes, locks,
usuarios, roles, solicitudes y contenido moderado. El stream público
`/api/v1/events/stream` filtra `admin.*`.

Ejemplo con curl:

```bash
curl -N \
  -H 'Accept: text/event-stream' \
  -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  'http://localhost:3010/api/v1/admin/events/stream?clientId=panel-admin-1'
```

## Postman

Genera los artefactos:

```bash
pnpm postman:generate
```

Importa:

1. `postman/ciudadaniasegurayaBE.postman_collection.json`
2. `postman/ciudadaniasegurayaBE.local.postman_environment.json`

Selecciona el environment local y completa solamente allí:

- `adminIdentifier`, `adminPassword`
- `superadminIdentifier`, `superadminPassword`

La colección incluye las variables pedidas:

- `adminAccessToken`, `superadminAccessToken`
- `adminUserId`, `normalUserId`
- `incidentId`, `adminRequestId`, `postId`, `commentId`

También contiene variables auxiliares de ciudad, versiones optimistas y
fusión. Los valores de credenciales y tokens se exportan vacíos.

Secuencia sugerida sobre una base desechable:

1. `Geolocation > List cities`.
2. `Auth > Register` para crear un `normalUserId`.
3. `Admin Authentication > Login admin`.
4. `Admin Authentication > Login superadmin`; guarda ambos access tokens,
   aunque el último login reemplaza la cookie admin actual en el cookie jar.
5. Ejecuta `Admin attempts to promote user - expect 403`.
6. Ejecuta `Admin attempts to modify another admin - expect 403`.
7. Crea un reporte público y lista la cola pendiente.
8. Consulta el detalle/versión, reclama el lock y aprueba o rechaza.
9. Crea una solicitud o recomendación y resuélvela como superadmin.
10. Consulta `Audit`.
11. Ejecuta promoción, degradación o borrado lógico únicamente al final.

No exportes el environment después de completar secretos. Postman conserva la
cookie HttpOnly en su cookie jar; para probar refresh de otra identidad,
vuelve a ejecutar su login.

## Pruebas

```bash
pnpm test:unit
MONGODB_TEST_URI='mongodb://...' pnpm test:integration
MONGODB_TEST_URI='mongodb://...' pnpm test:e2e
MONGODB_TEST_URI='mongodb://...' pnpm test
```

Antes de usar datos reales, verifica al menos:

- Admin y superadmin pueden iniciar; user y suspendido no.
- Admin puede cambiar un user, pero recibe `403` sobre admin/superadmin.
- Admin recibe `403` al promover; superadmin puede promover/degradar.
- El cambio de rol revoca sesiones.
- Dos admins no procesan la misma versión/lock del incidente.
- Aprobar incrementa estadísticas una vez; rechazar no.
- Moderación y operaciones críticas dejan auditoría.
- El stream público no recibe eventos `admin.*`.
