> 08/30/2026 11:11 AM — Superadmin Agent Control Proxy

The backend now mediates the hackathon agent control plane without exposing service credentials to the browser. Only the superadmin-only `agent.control` permission can read status/logs, start a 1–100 article run, or request cancellation. Start/cancel actions are audited, backend ingestion remains separately authenticated, and local deployments can seed a deterministic city ID shared with the agent.

Evidence: 161 unit tests and lint passed; the production image built; MongoDB initialization, deterministic Bogotá ID, superadmin login, and the authenticated agent-status proxy were verified in the local stack.

---

# ciudadaniasegurayaBE

Backend modular para una plataforma de seguridad ciudadana. Permite registrar
reportes, correlacionarlos geográficamente con H3, validarlos mediante señales
de tres usuarios distintos, consultar un mapa de calor móvil anual, participar
en un foro y moderar recursos con auditoría.

La validación comunitaria expresa una coincidencia entre reportes; no debe
interpretarse como una confirmación oficial ni como prueba definitiva.

## Tecnologías

- Node.js 22 LTS desde 22.13 o Node.js 24 LTS, JavaScript y ECMAScript Modules.
- Fastify 5.
- MongoDB mediante el driver oficial, sin ODM.
- H3 con `h3-js`.
- Zod como fuente de validación HTTP y de variables de entorno.
- JWT de acceso, refresh tokens opacos, HMAC y Argon2id.
- OpenAPI, Swagger UI, Server-Sent Events y Vitest.
- pnpm 11.1.3 con lockfile y políticas de cadena de suministro.

## Dependencias

| Dependencia | Versión | Propósito |
| --- | ---: | --- |
| `fastify` | 5.10.0 | Servidor HTTP |
| `mongodb` | 7.5.0 | Driver oficial de MongoDB |
| `h3-js` | 4.5.0 | Indexación geoespacial H3 |
| `zod` | 4.4.3 | Validación y esquemas |
| `dotenv` | 17.4.2 | Carga de entorno local |
| `@fastify/cors` | 11.3.0 | Lista permitida de orígenes |
| `@fastify/helmet` | 13.1.0 | Cabeceras de seguridad |
| `@fastify/jwt` | 10.2.0 | Access tokens |
| `@fastify/cookie` | 11.1.2 | Cookie HttpOnly de refresh |
| `@fastify/rate-limit` | 11.1.0 | Límites globales y por ruta |
| `@fastify/swagger` | 9.8.1 | Documento OpenAPI |
| `@fastify/swagger-ui` | 6.1.0 | Interfaz Swagger |
| `@fastify/sensible` | 6.0.4 | Utilidades HTTP |
| `@fastify/sse` | 0.5.0 | Streaming SSE, replay y heartbeat |
| `@fastify/compress` | 9.1.0 | Compresión HTTP |
| `@fastify/under-pressure` | 9.1.0 | Control de sobrecarga |
| `fastify-plugin` | 6.0.0 | Plugin de conexión compartida |
| `fastify-type-provider-zod` | 7.0.0 | Integración Zod/Fastify/OpenAPI |
| `google-auth-library` | 10.9.0 | Verificación oficial de Google ID tokens |
| `argon2` | 0.45.0 | Hash Argon2id |
| `nodemon` | 3.1.14 | Reinicio en desarrollo |
| `vitest` | 4.1.10 | Pruebas |
| `eslint` | 10.7.0 | Análisis estático |
| `pino-pretty` | 13.1.3 | Logs legibles en desarrollo |

`argon2` es la única dependencia autorizada para ejecutar un script de
instalación. Compila o selecciona su binario nativo mediante
`node-gyp-build`; la autorización explícita vive en `pnpm-workspace.yaml`.

## Requisitos previos

- Node.js `^22.13.0` o `>=24 <25`.
- Corepack.
- MongoDB 7 u 8 accesible desde el proceso.
- Un shell compatible con los comandos mostrados.

## Instalación segura

```bash
corepack enable
corepack prepare pnpm@11.1.3 --activate
pnpm install --frozen-lockfile
```

`pnpm-workspace.yaml` establece:

- `minimumReleaseAge: 10080`: cuarentena de siete días para dependencias
  directas y transitivas.
- `minimumReleaseAgeStrict: true`: un paquete inmaduro produce un error.
- `minimumReleaseAgeIgnoreMissingTime: false`: no se ignoran metadatos
  incompletos.
- `trustPolicy: no-downgrade`: impide degradar evidencia de confianza.
- `blockExoticSubdeps: true`: bloquea subdependencias de fuentes exóticas.
- `allowBuilds.argon2: true`: única excepción de script nativo auditada.
- `overrides`: fuerza `find-my-way@9.7.0`, `@fastify/static@10.1.2` y
  `brace-expansion@5.0.8`, que contienen los parches para
  `GHSA-c96f-x56v-gq3h`, `GHSA-83w8-p2f5-377r` y
  `GHSA-mh99-v99m-4gvg`.
- `minimumReleaseAgeExclude`: exceptúa únicamente esas tres versiones
  parcheadas porque la corrección de vulnerabilidades altas tiene prioridad
  sobre la cuarentena. La excepción debe retirarse cuando cumplan siete días.

No se deben añadir otras exclusiones para eludir una resolución fallida. Una
excepción exige una vulnerabilidad identificada, versión exacta y
documentación como la anterior.

## Variables de entorno

Usa [.env.example](./.env.example) como plantilla:

```env
NODE_ENV=development
HOST=0.0.0.0
PORT=3010
PUBLIC_API_BASE_URL=http://localhost:3010
TRUST_PROXY=false

MONGODB_URI=mongodb://usuario:clave@localhost:27017/?authSource=admin
MONGODB_DB_NAME=ciudadaniaseguraya

JWT_ACCESS_SECRET=secreto-aleatorio-de-al-menos-32-caracteres
JWT_REFRESH_SECRET=otro-secreto-aleatorio-de-al-menos-32-caracteres
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

CORS_ORIGINS=http://localhost:3001
CORS_ORIGIN_PATTERNS=

REFRESH_COOKIE_SAME_SITE=strict
REFRESH_COOKIE_SECURE=false
REFRESH_COOKIE_DOMAIN=

GOOGLE_CLIENT_ID=

DEFAULT_CITY_NAME=Bogota
DEFAULT_CITY_COUNTRY_CODE=CO
CITY_TIMEZONE=America/Bogota
H3_BASE_RESOLUTION=9
H3_SUPPORTED_RESOLUTIONS=4,5,6,7,8,9
INCIDENT_CONFIRMATION_THRESHOLD=3
INCIDENT_MATCH_WINDOW_MINUTES=180
AI_INGEST_API_KEY=
REALTIME_HEARTBEAT_MS=25000

SUPERADMIN_EMAIL=
SUPERADMIN_USERNAME=
SUPERADMIN_PASSWORD=
SUPERADMIN_DISPLAY_NAME=
ADMIN_AUTH_RATE_LIMIT_MAX=5
ADMIN_AUTH_RATE_LIMIT_WINDOW_MS=300000
LOG_LEVEL=info
```

`MONGODB_URI`, `JWT_ACCESS_SECRET` y `JWT_REFRESH_SECRET` son críticos. El
proceso falla antes de escuchar conexiones si faltan o son inválidos. Existe
compatibilidad temporal con la clave antigua `MONGODB`, pero debe migrarse a
`MONGODB_URI`.

`SUPERADMIN_*` solo es obligatorio al ejecutar el seed del superadmin. No se
registra ningún secreto, token, cookie, contraseña o URI completa. Una vez
creada la cuenta bootstrap, retira `SUPERADMIN_PASSWORD` del entorno de
ejecución normal.

`ADMIN_AUTH_RATE_LIMIT_MAX` y `ADMIN_AUTH_RATE_LIMIT_WINDOW_MS` controlan el
límite independiente del login y de la rotación administrativa. El servicio
también aplica retraso progresivo y bloqueo temporal en memoria por combinación
de identificador e IP. En producción, usa un almacén compartido antes de
escalar a varias réplicas. Las sesiones administrativas utilizan la cookie
HttpOnly `csy_admin_refresh`, restringida a `/api/v1/admin/auth`; no comparten
la cookie ni la colección de refresh del sitio público.

`PUBLIC_API_BASE_URL` alimenta OpenAPI y debe usar la URL HTTPS pública en
producción. `TRUST_PROXY` es `false`, un número de saltos entre 1 y 10, o una
lista de IP/CIDR; el valor amplio `true` se rechaza para impedir que un cliente
suplante `X-Forwarded-For`.

`CORS_ORIGINS` contiene orígenes exactos separados por comas.
`CORS_ORIGIN_PATTERNS` admite previews HTTPS con comodín únicamente en el
hostname. El patrón debe fijar proyecto o equipo, por ejemplo:

```env
CORS_ORIGIN_PATTERNS=https://ciudadaniasegurayafe-*-mi-equipo.vercel.app
```

No uses `https://*.vercel.app`: además de rechazarse al iniciar, permitiría
proyectos ajenos. Las operaciones que crean o rotan cookies vuelven a comprobar
el header `Origin`; clientes de servidor o Postman pueden omitirlo.

Para frontend y API bajo el mismo sitio registrable, conserva
`REFRESH_COOKIE_SAME_SITE=strict`. Si Vercel y la API usan sitios distintos,
configura `none` junto con `REFRESH_COOKIE_SECURE=true`. Los navegadores pueden
bloquear cookies de terceros, por lo que la opción más robusta en producción es
usar dominios propios como `app.example.com` y `api.example.com`.
`REFRESH_COOKIE_DOMAIN` normalmente debe quedar vacío para obtener una cookie
host-only; si se define, set y clear usan exactamente ese dominio.

`GOOGLE_CLIENT_ID` es el Client ID web público de Google Identity Services. El
backend verifica firma, expiración, issuer, audience y correo verificado; nunca
recibe ni almacena un refresh token de Google.

## Base de datos

Inicializa colecciones, validadores, índices, ciudad y ajustes:

```bash
pnpm db:init
```

El comando es idempotente: crea colecciones nuevas y aplica `collMod` a las
existentes. Configura:

- Unicidad de email, username, identidad Google, reportante, confirmación y
  reacción.
- Índice TTL para refresh tokens.
- Índices `2dsphere` para incidentes, límites de ciudad y viewport del mapa.
- Índices por ciudad, estado, fecha, tipo y resoluciones H3.
- Agregados mensuales en `hex_monthly_stats`.

El seed inicial de Bogotá incluye centro, bounds y un límite administrativo
simplificado obtenido de
[OpenStreetMap relation 7426387](https://www.openstreetmap.org/relation/7426387)
bajo ODbL 1.0. Una ciudad distinta debe cargar su propio `boundary` GeoJSON:
si no existe, el backend rechaza nuevos reportes en vez de aceptar cualquier
coordenada.

Después de habilitar resoluciones H3 nuevas o al migrar datos previos, ejecuta:

```bash
pnpm db:backfill:geospatial
```

El comando puede repetirse: recalcula `h3Cells`, sincroniza
`statisticsApplied` y reconstruye `hex_monthly_stats` para todas las
resoluciones configuradas. Primero ejecuta `db:init` (el propio script también
lo hace), toma un respaldo y prográmalo en una ventana de mantenimiento antes
de usarlo sobre datos de producción. Los agregados actualizados después de
iniciar el proceso no se eliminan como obsoletos.

Colecciones: `users`, `refresh_tokens`, `admin_refresh_tokens`,
`admin_role_requests`, `cities`, `incidents`, `incident_reports`,
`incident_confirmations`, `hex_monthly_stats`, `posts`, `comments`,
`reactions`, `audit_logs` y `app_settings`.

Para crear o sincronizar el superadministrador bootstrap:

```bash
pnpm db:seed:superadmin
```

Al iniciar el backend se actualizan primero los validadores e índices de
MongoDB y después se sincroniza la cuenta bootstrap desde
`SUPERADMIN_EMAIL`, `SUPERADMIN_USERNAME`, `SUPERADMIN_PASSWORD` y
opcionalmente `SUPERADMIN_DISPLAY_NAME`. Usa Argon2id, marca la cuenta como
bootstrap y no crea duplicados. Si las tres credenciales obligatorias están
vacías, no modifica la base de datos; si son iguales a la cuenta existente,
no la actualiza. Una configuración parcial impide el arranque para evitar una
cuenta administrativa inconsistente.

`AI_INGEST_API_KEY` habilita el `POST` servidor a servidor para el scraper con
IA. Debe contener al menos 32 caracteres, permanecer fuera del frontend y
enviarse en `X-AI-Ingest-Key`. Si queda vacia, la ruta permanece deshabilitada.
Consulta el contrato y un ejemplo completo en
[API de ingesta con IA](./docs/ai-ingestion-api.md).

Para poblar un ambiente de demostración con incidentes visibles:

```bash
pnpm db:seed:demo-incidents:2026
```

El comando inicializa la base y el administrador si hace falta, y registra
exactamente 250 incidentes `admin_verified` en 16 hotspots dentro de Bogotá.
Las fechas se distribuyen desde el 1 de enero de 2026 hasta quince minutos
antes de la ejecución, sin crear hechos futuros. Cada registro usa un
`ObjectId` determinista y el lote
`bogota-2026-annual-heatmap-v1`, por lo que repetir el comando reemplaza el
mismo conjunto en vez de duplicarlo. Al terminar reconstruye H3 y
`hex_monthly_stats`.

Para añadir cobertura territorial y un gradiente vecinal en 2026:

```bash
pnpm db:seed:demo-neighbor-incidents:2026
```

Este segundo comando valida los 250 registros base y reutiliza exactamente el
mismo administrador si conserva un rol administrativo activo. Redistribuye
cinco registros sintéticos de Usaquén y crea 1.000 adicionales con IDs
deterministas en el lote
`bogota-2026-annual-heatmap-neighbor-gradient-v1`. El resultado combinado es:

- 1.250 incidentes sintéticos en 922 celdas H3 de resolución 9.
- 30 registros en `8966e42f2abffff`.
- 18, 18, 18, 17, 17 y 17 registros en sus seis vecinos inmediatos.
- 900 celdas territoriales con un registro cada una; 895 pertenecen al lote
  adicional y cinco proceden de la redistribución base.
- Cobertura de los 578 padres H3 de resolución 8, los 104 de resolución 7 y
  los 22 de resolución 6 presentes en el límite simplificado de Bogotá.
- Al menos un registro en cada vecino inmediato de los otros 15 hotspots.

La cobertura usa celdas cuyo centro pertenece al `BOGOTA_BOUNDARY` sembrado;
no significa que todo el hexágono esté contenido en el límite ni que las 3.598
celdas de resolución 9 de Bogotá tengan incidentes. Las fechas del lote
adicional abarcan desde el 1 de enero de 2026 hasta quince minutos antes de la
ejecución. Repetir el comando no duplica documentos, repara estados parciales
y actualiza ese rango temporal hasta la nueva ejecución.
Una vez activo este layout, el seed base rechaza ejecuciones que desharían las
cinco redistribuciones; usa siempre el comando de cobertura para reconciliar.

Para comprobar todas las precondiciones y generar el resumen sin escribir:

```bash
pnpm db:seed:demo-neighbor-incidents:2026 -- --dry-run
```

En `NODE_ENV=production` el comando rechaza escrituras salvo que se habiliten
de forma explícita para esa ejecución:

```bash
ALLOW_SYNTHETIC_PRODUCTION_SEED=true pnpm db:seed:demo-neighbor-incidents:2026
```

Estos documentos son datos sintéticos para validar el mapa y están marcados
con `seedMetadata.synthetic=true`; no deben presentarse como hechos de
seguridad reales ni cargarse accidentalmente en una base de producción. El
backfill reconstruye agregados de toda la base, así que en un entorno con
tráfico debe ejecutarse con un respaldo reciente y en una ventana de
mantenimiento. Si el backfill falla después de insertar el lote, repite el
comando dentro de la misma ventana para completar la sincronización.

## Ejecución

Desarrollo:

```bash
pnpm dev
```

Producción:

```bash
NODE_ENV=production pnpm start
```

URLs locales:

- API: `http://localhost:3010`
- Salud: `http://localhost:3010/health`
- Disponibilidad: `http://localhost:3010/ready`
- Swagger UI: `http://localhost:3010/docs`
- OpenAPI JSON: `http://localhost:3010/docs/json`

El servidor mantiene una sola instancia de `MongoClient`, la reutiliza en
todas las peticiones y la cierra ante `SIGINT`, `SIGTERM` o `app.close()`.

## Despliegue

El backend necesita un proceso Node persistente; no debe desplegarse como una
función serverless porque mantiene conexiones SSE abiertas. Configuración base
para un PaaS o contenedor:

```text
Install: pnpm install --frozen-lockfile
Release/one-off: pnpm db:init
Start: pnpm start
Liveness: GET /health
Readiness: GET /ready
```

`HOST=0.0.0.0` y `PORT` respetan el puerto asignado por el proveedor.
`/health` y `/ready` están excluidos del rate limit; readiness comprueba MongoDB
y todas las colecciones requeridas. El inicializador es idempotente, pero debe
terminar antes de enrutar tráfico. Ejecuta el seed administrativo por separado.

Para producción configura al menos `NODE_ENV=production`,
`PUBLIC_API_BASE_URL`, MongoDB, secretos JWT distintos por ambiente, CORS,
cookie y `TRUST_PROXY` según la cadena real del balanceador. Tanto la API como
SSE deben publicarse mediante HTTPS para que una aplicación Vercel no incurra
en mixed content. `.dockerignore` excluye `.env`, Git, dependencias, cobertura
y logs del contexto de imagen.

La implementación SSE y el rate limit usan memoria de proceso. Mantén una sola
réplica inicialmente; antes de escalar horizontalmente incorpora un bus y un
store compartidos. El proxy debe permitir respuestas largas, no bufferizar
`text/event-stream` y tener un idle timeout superior al heartbeat configurado.

## Arquitectura

```text
Cliente
  -> Route + Zod + auth/RBAC
  -> Controller
  -> Service
  -> Repository
  -> MongoDB
  -> DTO
  -> Controller
  -> Respuesta

Service
  -> Event Bus
  -> Transporte SSE
  -> Clientes
```

La aplicación es un monolito modular:

```text
src/
├── app/                    # composición, rutas raíz y arranque
├── modules/
│   ├── auth/               # sesiones y refresh tokens
│   ├── admin/              # RBAC, sesión admin y gestión administrativa
│   ├── users/              # perfiles y administración
│   ├── incidents/          # correlación, validación y moderación
│   ├── geolocation/        # H3, ciudades y heatmap
│   ├── statistics/         # agregaciones públicas y series temporales
│   └── forum/              # posts, comentarios y reacciones
├── shared/                 # config, DB, errores, seguridad y utilidades
└── infrastructure/
    ├── cache/              # caché en memoria reemplazable
    └── messaging/          # bus, SSE y conexiones
```

Las rutas solo declaran HTTP, middleware y esquemas. Los controladores
traducen HTTP a llamadas de servicio. Los servicios aplican reglas y coordinan
repositorios. Solo los repositorios acceden a MongoDB. Los DTO eliminan campos
privados antes de responder.

## Autenticación y seguridad

- Contraseñas con Argon2id.
- Access JWT corto en `Authorization: Bearer`.
- Refresh token opaco aleatorio; solo su HMAC-SHA256 se guarda en MongoDB.
- Rotación atómica: el refresh anterior queda revocado y enlazado al nuevo.
- El refresh token solo viaja en la cookie HttpOnly `csy_refresh`; nunca aparece
  en JSON ni se acepta desde el body.
- La sesión administrativa usa access JWT en memoria del cliente y una cookie
  HttpOnly separada `csy_admin_refresh`; un token público no autoriza `/admin`.
- El login `/api/v1/admin/auth/login` admite únicamente roles `admin` y
  `superadmin`, responde errores genéricos y audita éxitos y fallos sin guardar
  identificadores, credenciales o tokens en claro.
- La matriz central de permisos y `requirePermission` son la fuente de verdad;
  ocultar controles en el frontend no concede ni reemplaza autorización.
- Cookie host-only por defecto, con `SameSite`, `Secure` y dominio configurables
  y combinaciones inseguras rechazadas al iniciar.
- Google Identity se verifica con la biblioteca oficial y el audience
  configurado. Una coincidencia de email no vincula cuentas automáticamente.
- Vinculación Google protegida por Bearer y coincidencia del correo verificado.
- Revocación de la sesión actual o de todas las sesiones.
- Una cuenta suspendida se comprueba contra MongoDB en cada petición.
- Eliminación de cuenta con anonimización y revocación total.
- Helmet, CORS permitido, body de 1 MiB, timeouts y rate limiting.
- Validación de `Origin` en operaciones de sesión basadas en cookie.
- Límite más estricto en registro, login y reportes.
- Errores centralizados sin stack en respuestas.
- Logs sin cuerpos, tokens, cookies, emails ni direcciones IP.

## Administración, roles y permisos

Los roles efectivos son `user`, `admin` y `superadmin`. `admin` y
`superadmin` comparten el panel y la ruta de acceso, pero solo el
`superadmin` puede asignar o retirar autoridad administrativa. Las rutas
generales de usuario rechazan `role`, `permissions` y `adminMetadata`; los
cambios de rol usan endpoints exclusivos, revocan sesiones y generan
auditoría.

Permisos centralizados:

| Permiso | User | Admin | Superadmin |
| --- | :---: | :---: | :---: |
| `admin.dashboard.read` | No | Sí | Sí |
| `users.read`, `users.update`, `users.suspend`, `users.delete` | No | Sí | Sí |
| `admins.read` | No | Sí | Sí |
| `admins.update`, `admins.promote`, `admins.demote`, `admins.suspend` | No | No | Sí |
| `adminRequests.create` | Sí | Sí | Sí |
| `adminRequests.read`, `adminRequests.resolve` | No | No | Sí |
| `incidents.read`, `incidents.createVerified`, `incidents.approve` | No | Sí | Sí |
| `incidents.reject`, `incidents.update`, `incidents.merge` | No | Sí | Sí |
| `posts.moderate`, `comments.moderate` | No | Sí | Sí |
| `audit.readOwn` | No | Sí | Sí |
| `audit.readAll` | No | No | Sí |
| `settings.read`, `settings.update` | No | No | Sí |
| `sessions.revoke` | No | Sí | Sí |

El permiso `adminRequests.create` permite a un usuario solicitar el rol y a un
admin recomendar un candidato; no permite resolver solicitudes. Un admin solo
puede mutar cuentas con rol `user`, aunque conozca el ID de otro admin. El
superadmin bootstrap no se puede degradar, suspender o eliminar mediante los
flujos ordinarios. Los motivos de acciones sensibles son obligatorios y la
moderación de incidentes usa `expectedUpdatedAt` y bloqueos temporales para
detectar revisiones concurrentes con `409`.

Inicio local del subsistema:

```bash
pnpm db:init
pnpm db:seed:superadmin
pnpm dev
```

Configura `SUPERADMIN_EMAIL`, `SUPERADMIN_USERNAME`,
`SUPERADMIN_PASSWORD` y, opcionalmente, `SUPERADMIN_DISPLAY_NAME` solo para el
seed. Después inicia sesión en `POST /api/v1/admin/auth/login`; no se comparan
credenciales contra el entorno durante el login. Se recomienda MFA para todo
admin y debe considerarse obligatorio para el superadmin antes de producción.

La referencia operativa completa, incluidos cuerpos, filtros, errores y
secuencia de prueba, está en
[docs/admin-api.md](./docs/admin-api.md).

## Incidentes y validación comunitaria

Un reporte ciudadano:

1. Valida usuario, ciudad, categoría, fecha y coordenadas.
2. Construye GeoJSON como `[longitud, latitud]`.
3. Calcula H3 como `latLngToCell(latitud, longitud, resolución)`.
4. Busca misma ciudad, categoría, ventana temporal y celda base/vecina.
5. Crea o asocia el reporte al incidente consolidado.
6. Registra una confirmación única para ese reportante.
7. Cuenta solo usuarios actualmente activos.
8. Al alcanzar el umbral persistido, hace una transición atómica a
   `community_confirmed`.
9. Reclama una sola vez la actualización estadística y publica eventos.

Estados: `pending`, `community_confirmed`, `admin_verified`, `rejected` y
`archived`. Un incidente administrativo nace como `admin_verified`.

Las categorías sensibles (`secuestro`, `violencia_sexual` y
`violencia_intrafamiliar`) no exponen el punto exacto; la respuesta conserva
el hexágono.

## H3 y mapa de calor

GeoJSON y H3 usan órdenes distintos:

```text
GeoJSON Point: [longitud, latitud]
H3:            latLngToCell(latitud, longitud, resolución)
```

Cada incidente guarda celdas para todas las resoluciones configuradas. Solo
`community_confirmed` y `admin_verified` incrementan los agregados. La
actualización usa una reclamación atómica `statisticsApplied` para que dos
confirmaciones concurrentes no incrementen dos veces.

La configuración inicial habilita H3 `4,5,6,7,8,9`, con resolución base `9`.
`GET /api/v1/geolocation/config` publica este contrato y la escala de color
para que el frontend no duplique constantes.

| Incidentes durante los últimos 12 meses | Nivel | Color |
| ---: | ---: | --- |
| 0 | 0 | `#2563EB` |
| 1-2 | 1 | `#22C55E` |
| 3-5 | 2 | `#EAB308` |
| 6-9 | 3 | `#F97316` |
| 10-19 | 4 | `#EF4444` |
| 20+ | 5 | `#111827` |

El endpoint de heatmap exige límites del viewport. Sin `month`, agrega
directamente los incidentes públicos comprendidos entre el instante actual y
el mismo instante del año anterior. Por eso cada incidente deja de afectar el
color al superar su aniversario: si la celda queda en cero, vuelve a azul.
`month=YYYY-MM` se conserva únicamente para consultas históricas explícitas.

## Estadísticas públicas

El módulo `statistics` consulta directamente la colección `incidents` mediante
pipelines de agregación MongoDB. Todos sus endpoints son públicos, pero solo
cuentan los estados `community_confirmed` y `admin_verified`; excluyen
pendientes, rechazados, archivados y documentos eliminados.

Filtros comunes:

- `cityId`: ciudad activa opcional. Sin ciudad, el alcance es el país
  configurado.
- `h3Index`: celda opcional en los cuatro endpoints generales. La resolución
  se obtiene del propio índice y debe estar habilitada.
- `from` y `to`: instantes ISO 8601 con offset. Si falta `to`, se usa la hora
  actual; si falta `from`, se consultan los 365 días anteriores.
- `incidentType`: categoría admitida opcional.
- `timezone`: zona IANA usada para agrupaciones, por defecto
  `America/Bogota`.
- `groupBy`: `year`, `month`, `day` u `hour`, disponible en series.

`overview` también compara el total con el periodo inmediatamente anterior de
igual duración. `hourly` siempre devuelve las 24 horas, incluidas las que
tienen cero registros. `types` devuelve todas las categorías, incluidas las
que tienen cero. El endpoint del hexágono combina resumen, serie, horas y
tipos en una sola respuesta.

## Tiempo real

`GET /api/v1/events/stream` usa `text/event-stream`.

- Heartbeat configurado por `REALTIME_HEARTBEAT_MS`.
- Backpressure gestionado por `@fastify/sse`.
- Eventos con UUID, tipo, fecha UTC y datos públicos.
- Replay con `Last-Event-ID` o query `lastEventId` sobre un historial acotado;
  el header tiene prioridad.
- Limpieza inmediata al cerrar el cliente.
- Máximo global y máximo por `clientId`, sin almacenar IPs.

Eventos de dominio: `incident.created`, `incident.updated`,
`incident.community_confirmed`, `incident.admin_verified`,
`incident.rejected`, `incident.merged`, `heatmap.updated`, `post.created`,
`post.updated`, `comment.created` y `comment.updated`.

`GET /api/v1/admin/events/stream` exige un access token administrativo activo
y entrega únicamente eventos de alcance administrativo. El stream público
filtra `admin.*`, de modo que bloqueos de revisión, cambios de usuarios,
solicitudes y actividad de moderación no se exponen a visitantes. Ambos streams
admiten `clientId`, `Last-Event-ID`/`lastEventId`, replay y heartbeat.

`heatmap.updated` conserva `months`, `resolutions` y `occurredAt`, y además
incluye `updates`. Cada entrada identifica `month`, `resolution`, `h3Index` e
`incidentType`, junto con `incidentCount`, `level`, `color`,
`lastUpdatedAt` y los valores específicos del tipo. Esto permite actualizar
solo las celdas afectadas sin recargar el viewport completo.

El servicio depende de la interfaz del bus, no de Redis. La implementación en
memoria puede sustituirse por Redis Pub/Sub o Change Streams sin cambiar los
servicios de negocio.

## Respuestas, paginación y errores

Éxito:

```json
{
  "success": true,
  "data": {},
  "meta": { "requestId": "req-1" }
}
```

Paginación:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5,
    "requestId": "req-1"
  }
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Los datos enviados no son validos",
    "details": []
  },
  "meta": { "requestId": "req-1" }
}
```

Los listados limitan `pageSize` a 100. Se usan `400`, `401`, `403`, `404`,
`409`, `422`, `429`, `500` y `503` según el caso.

## Tabla de rutas

| Método | Ruta | Autenticación | Rol | Descripción |
| --- | --- | --- | --- | --- |
| GET | `/` | No | Público | Identifica el servicio |
| GET | `/health` | No | Público | Salud del proceso |
| GET | `/ready` | No | Público | Disponibilidad de MongoDB |
| GET | `/docs` | No | Público | Swagger UI |
| GET | `/docs/json` | No | Público | OpenAPI JSON |
| POST | `/api/v1/auth/register` | No | Público | Registrar cuenta |
| POST | `/api/v1/auth/login` | No | Público | Iniciar sesión |
| POST | `/api/v1/auth/google` | Google ID | Público | Iniciar sesión con Google |
| POST | `/api/v1/auth/google/link` | Bearer + Google ID | Usuario | Vincular Google |
| POST | `/api/v1/auth/refresh` | Refresh | Usuario | Rotar sesión |
| POST | `/api/v1/auth/logout` | Refresh | Usuario | Cerrar sesión |
| POST | `/api/v1/auth/logout-all` | Bearer | Usuario | Cerrar todas |
| GET | `/api/v1/auth/me` | Bearer | Usuario | Perfil propio |
| POST | `/api/v1/admin/auth/login` | Credenciales | Admin/Superadmin | Iniciar sesión administrativa |
| POST | `/api/v1/admin/auth/refresh` | Cookie admin | Admin/Superadmin | Rotar sesión admin |
| POST | `/api/v1/admin/auth/logout` | Cookie admin | Admin/Superadmin | Cerrar sesión admin |
| POST | `/api/v1/admin/auth/logout-all` | Bearer admin | Admin/Superadmin | Revocar sesiones admin propias |
| GET | `/api/v1/admin/auth/me` | Bearer admin | Admin/Superadmin | Identidad y permisos efectivos |
| GET | `/api/v1/users/:userId` | No | Público | Perfil público |
| PATCH | `/api/v1/users/me` | Bearer | Usuario | Editar perfil |
| DELETE | `/api/v1/users/me` | Bearer | Usuario | Eliminar cuenta |
| GET | `/api/v1/admin/dashboard` | Bearer admin | `admin.dashboard.read` | Resumen administrativo |
| GET | `/api/v1/admin/users` | Bearer admin | `users.read` | Listar usuarios normales |
| GET | `/api/v1/admin/users/:userId` | Bearer admin | `users.read` | Ver usuario normal |
| PATCH | `/api/v1/admin/users/:userId` | Bearer admin | `users.update` | Editar campos permitidos |
| POST | `/api/v1/admin/users/:userId/suspend` | Bearer admin | `users.suspend` | Suspender usuario |
| POST | `/api/v1/admin/users/:userId/reactivate` | Bearer admin | `users.suspend` | Reactivar usuario |
| POST | `/api/v1/admin/users/:userId/revoke-sessions` | Bearer admin | `sessions.revoke` | Revocar sesiones públicas |
| DELETE | `/api/v1/admin/users/:userId` | Bearer admin | `users.delete` | Anonimizar y eliminar lógicamente |
| GET | `/api/v1/admin/administrators` | Bearer admin | `admins.read` | Listar administradores |
| GET | `/api/v1/admin/administrators/:adminId` | Bearer admin | `admins.read` | Ver administrador según alcance |
| POST | `/api/v1/admin/users/:userId/promote` | Bearer admin | `admins.promote` | Promover a admin |
| POST | `/api/v1/admin/administrators/:adminId/demote` | Bearer admin | `admins.demote` | Degradar admin |
| POST | `/api/v1/admin/administrators/:adminId/suspend` | Bearer admin | `admins.suspend` | Suspender admin |
| POST | `/api/v1/admin/administrators/:adminId/reactivate` | Bearer admin | `admins.suspend` | Reactivar admin |
| POST | `/api/v1/admin/administrators/:adminId/revoke-sessions` | Bearer admin | `admins.update` | Revocar sesiones admin |
| POST | `/api/v1/admin-role-requests` | Bearer público | Usuario | Solicitar rol admin |
| GET | `/api/v1/admin-role-requests/me` | Bearer público | Usuario | Listar solicitudes propias |
| DELETE | `/api/v1/admin-role-requests/:requestId` | Bearer público | Usuario | Cancelar solicitud pendiente |
| POST | `/api/v1/admin/admin-role-requests` | Bearer admin | `adminRequests.create` | Recomendar candidato |
| GET | `/api/v1/admin/admin-role-requests/mine` | Bearer admin | `adminRequests.create` | Ver recomendaciones propias |
| GET | `/api/v1/admin/admin-role-requests` | Bearer admin | `adminRequests.read` | Listar solicitudes |
| GET | `/api/v1/admin/admin-role-requests/:requestId` | Bearer admin | `adminRequests.read` | Ver solicitud |
| POST | `/api/v1/admin/admin-role-requests/:requestId/request-information` | Bearer admin | `adminRequests.resolve` | Pedir información adicional |
| POST | `/api/v1/admin/admin-role-requests/:requestId/approve` | Bearer admin | `adminRequests.resolve` | Aprobar y promover |
| POST | `/api/v1/admin/admin-role-requests/:requestId/reject` | Bearer admin | `adminRequests.resolve` | Rechazar solicitud |
| GET | `/api/v1/admin/audit` | Bearer admin | `audit.readOwn`/`audit.readAll` | Consultar auditoría por alcance |
| GET | `/api/v1/admin/settings` | Bearer admin | `settings.read` | Consultar ajustes operativos |
| PATCH | `/api/v1/admin/settings` | Bearer admin | `settings.update` | Actualizar ajuste permitido |
| GET | `/api/v1/incidents/types` | No | Público | Categorías |
| POST | `/api/v1/incidents/reports` | Bearer | Usuario | Crear reporte |
| GET | `/api/v1/incidents` | No | Público | Listar validados |
| GET | `/api/v1/incidents/nearby` | No | Público | Buscar cercanos |
| GET | `/api/v1/incidents/:incidentId` | No | Público | Ver incidente |
| PATCH | `/api/v1/incidents/:incidentId` | Bearer | Autor | Editar pendiente |
| DELETE | `/api/v1/incidents/:incidentId` | Bearer | Autor | Archivar pendiente |
| POST | `/api/v1/incidents/:incidentId/confirm` | Bearer | Usuario | Confirmar |
| DELETE | `/api/v1/incidents/:incidentId/confirm` | Bearer | Usuario | Retirar confirmación |
| POST | `/api/v1/admin/incidents` | Bearer | Admin | Crear validado |
| GET | `/api/v1/admin/incidents` | Bearer admin | `incidents.read` | Cola de moderación |
| GET | `/api/v1/admin/incidents/:incidentId` | Bearer admin | `incidents.read` | Detalle de moderación |
| PATCH | `/api/v1/admin/incidents/:incidentId` | Bearer | Admin | Editar incidente |
| POST | `/api/v1/admin/incidents/:incidentId/approve` | Bearer | Admin | Aprobar |
| POST | `/api/v1/admin/incidents/:incidentId/reject` | Bearer | Admin | Rechazar |
| POST | `/api/v1/admin/incidents/:incidentId/merge` | Bearer | Admin | Fusionar |
| POST | `/api/v1/admin/incidents/:incidentId/review-lock` | Bearer admin | `incidents.update` | Reclamar revisión |
| DELETE | `/api/v1/admin/incidents/:incidentId/review-lock` | Bearer admin | `incidents.update` | Liberar revisión |
| GET | `/api/v1/geolocation/cell` | No | Público | Calcular H3 |
| GET | `/api/v1/geolocation/cities` | No | Público | Listar ciudades |
| GET | `/api/v1/geolocation/config` | No | Público | Configuración del mapa |
| GET | `/api/v1/geolocation/heatmap` | No | Público | Viewport anual móvil |
| GET | `/api/v1/geolocation/hexagons/:h3Index` | No | Público | Detalle hexágono |
| GET | `/api/v1/geolocation/hexagons/:h3Index/statistics` | No | Público | Estadísticas del hexágono |
| GET | `/api/v1/statistics/overview` | No | Público | Resumen y comparación |
| GET | `/api/v1/statistics/timeseries` | No | Público | Serie temporal |
| GET | `/api/v1/statistics/hourly` | No | Público | Distribución por hora |
| GET | `/api/v1/statistics/types` | No | Público | Distribución por categoría |
| POST | `/api/v1/posts` | Bearer | Usuario | Crear post |
| GET | `/api/v1/posts` | No | Público | Listar posts |
| GET | `/api/v1/posts/:postId` | No | Público | Ver post |
| PATCH | `/api/v1/posts/:postId` | Bearer | Autor | Editar post |
| DELETE | `/api/v1/posts/:postId` | Bearer | Autor | Eliminar post |
| POST | `/api/v1/posts/:postId/comments` | Bearer | Usuario | Comentar |
| GET | `/api/v1/posts/:postId/comments` | No | Público | Listar comentarios |
| PATCH | `/api/v1/comments/:commentId` | Bearer | Autor | Editar comentario |
| DELETE | `/api/v1/comments/:commentId` | Bearer | Autor | Eliminar comentario |
| POST | `/api/v1/posts/:postId/reactions` | Bearer | Usuario | Reaccionar a post |
| DELETE | `/api/v1/posts/:postId/reactions/:reactionType` | Bearer | Usuario | Retirar reacción |
| POST | `/api/v1/comments/:commentId/reactions` | Bearer | Usuario | Reaccionar a comentario |
| DELETE | `/api/v1/comments/:commentId/reactions/:reactionType` | Bearer | Usuario | Retirar reacción |
| GET | `/api/v1/admin/posts` | Bearer admin | `posts.moderate` | Listar posts para moderación |
| GET | `/api/v1/admin/posts/:postId` | Bearer admin | `posts.moderate` | Ver contexto del post |
| PATCH | `/api/v1/admin/posts/:postId` | Bearer admin | `posts.moderate` | Editar post con motivo |
| PATCH | `/api/v1/admin/posts/:postId/status` | Bearer admin | `posts.moderate` | Compatibilidad: cambiar estado |
| POST | `/api/v1/admin/posts/:postId/hide` | Bearer admin | `posts.moderate` | Ocultar post |
| POST | `/api/v1/admin/posts/:postId/restore` | Bearer admin | `posts.moderate` | Restaurar post |
| DELETE | `/api/v1/admin/posts/:postId` | Bearer admin | `posts.moderate` | Eliminar lógicamente post |
| GET | `/api/v1/admin/comments` | Bearer admin | `comments.moderate` | Listar comentarios |
| GET | `/api/v1/admin/comments/:commentId` | Bearer admin | `comments.moderate` | Ver contexto del comentario |
| PATCH | `/api/v1/admin/comments/:commentId` | Bearer admin | `comments.moderate` | Editar comentario con motivo |
| PATCH | `/api/v1/admin/comments/:commentId/status` | Bearer admin | `comments.moderate` | Compatibilidad: cambiar estado |
| POST | `/api/v1/admin/comments/:commentId/hide` | Bearer admin | `comments.moderate` | Ocultar comentario |
| POST | `/api/v1/admin/comments/:commentId/restore` | Bearer admin | `comments.moderate` | Restaurar comentario |
| DELETE | `/api/v1/admin/comments/:commentId` | Bearer admin | `comments.moderate` | Eliminar lógicamente comentario |
| GET | `/api/v1/events/stream` | No | Público | Flujo SSE |
| GET | `/api/v1/admin/events/stream` | Bearer admin | Admin/Superadmin | Flujo SSE protegido |

## Referencia de endpoints

Convenciones: los endpoints protegidos usan
`Authorization: Bearer {{accessToken}}`; los administrativos usan
`{{adminAccessToken}}`. Todos pueden recibir `X-Request-Id`. Las fichas
indican los datos variables y complementan los esquemas exactos de Swagger.
En esta sección, las rutas abreviadas de negocio comienzan con `/api/v1`.

### Salud y autenticación

- `GET /`, `/health`, `/ready`, `/docs/json`: sin body. Éxito `200`;
  `/ready` también puede responder `503`. Ejemplo Postman: carpeta `Health`.
- `GET /docs`: abre HTML de Swagger; éxito `200`.
- `POST /auth/register`: body `email`, `username`, `password`; `201` devuelve
  usuario y access; el refresh se fija como cookie HttpOnly. Errores `400`,
  `409`, `429`.
- `POST /auth/login`: body `identifier`, `password`; `200`. Errores `400`,
  `401`, `403`, `429`.
- `POST /auth/google`: body `credential` de Google Identity Services; crea una
  cuenta Google o inicia sesión si `sub` ya está vinculado. Si el correo
  pertenece a una cuenta local devuelve `GOOGLE_ACCOUNT_LINK_REQUIRED`.
- `POST /auth/google/link`: Bearer y body `credential`; vincula de forma
  idempotente solo cuando el correo verificado coincide.
- `POST /auth/refresh`: sin body; rota exclusivamente la cookie HttpOnly y
  devuelve un access token nuevo. Errores `401`, `403`, `429`.
- `POST /auth/logout`: sin body; revoca la cookie y responde `204`.
- `POST /auth/logout-all`: Bearer; éxito `204`; errores `401`, `403`.
- `GET /auth/me`: Bearer; éxito `200`; errores `401`, `403`.

Ejemplo:

```bash
curl -X POST http://localhost:3010/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -c cookies.txt \
  -d '{"email":"ana@example.test","username":"ana_segura","password":"Clave-Segura-2026"}'

curl -X POST http://localhost:3010/api/v1/auth/refresh \
  -b cookies.txt \
  -c cookies.txt
```

### Usuarios

- `GET /users/:userId`: param ObjectId; `200` sin email; `400` o `404`.
- `PATCH /users/me`: Bearer; body `email` y/o `username`; `200`; `409` si
  colisiona.
- `DELETE /users/me`: Bearer; anonimiza, revoca y devuelve `204`.

Ejemplo Postman: carpeta `Users`. La gestión de terceros se describe en la
sección administrativa siguiente.

### API administrativa

Todas las rutas bajo `/admin`, salvo el login y refresh, requieren
`Authorization: Bearer {{adminAccessToken}}` o
`{{superadminAccessToken}}`. El middleware vuelve a cargar la cuenta y sus
permisos; un access token público recibe `401`. Los endpoints mutables exigen
un `reason` de 10 a 1000 caracteres cuando corresponde.

Autenticación aislada:

- `POST /admin/auth/login`: body `identifier`, `password`; devuelve access,
  identidad y permisos. Solo `admin`/`superadmin`; `401`, `403` o `429`.
- `POST /admin/auth/refresh`: rota la cookie HttpOnly admin; `200`.
- `POST /admin/auth/logout`: revoca la sesión indicada por la cookie; `204`.
- `POST /admin/auth/logout-all`: Bearer admin; revoca las sesiones propias;
  `204`.
- `GET /admin/auth/me`: identidad, estado, rol, último acceso y permisos;
  `200`, `401` o `403`.

Dashboard y usuarios normales:

- `GET /admin/dashboard`: contadores, cola antigua y actividad reciente.
- `GET /admin/users`: filtros `search`, `status`, `page`, `pageSize`,
  `sortBy` y `sortOrder`.
- `GET /admin/users/:userId`: detalle permitido, actividad y solicitud admin.
- `PATCH /admin/users/:userId`: `username` y/o `displayName`, más `reason`.
- `POST /admin/users/:userId/suspend`, `/reactivate` y `/revoke-sessions`:
  body `reason`.
- `DELETE /admin/users/:userId`: body `reason` y
  `confirmation: "ELIMINAR"`; anonimiza cuenta y contenido.

Administradores y solicitudes:

- `GET /admin/administrators` y `/:adminId`: lectura básica para admin; el
  detalle privado depende de permisos. El listado acepta `search`, `status`,
  `page` y `pageSize`; el superadmin también puede buscar por correo.
- `POST /admin/users/:userId/promote`: solo `admins.promote`.
- `POST /admin/administrators/:adminId/demote`, `/suspend`, `/reactivate` y
  `/revoke-sessions`: permisos de superadmin y body `reason`.
- `POST /admin-role-requests`: Bearer público; body `motivation` y
  `experience` opcional.
- `GET /admin-role-requests/me` y
  `DELETE /admin-role-requests/:requestId`: consulta/cancelación propia.
- `POST /admin/admin-role-requests`: admin recomienda con `candidateUserId`,
  `motivation` y `experience`.
- `GET /admin/admin-role-requests/mine`: recomendaciones propias.
- `GET /admin/admin-role-requests` y `/:requestId`: solo
  `adminRequests.read`.
- `POST /admin/admin-role-requests/:requestId/request-information`: solo
  `adminRequests.resolve`, body `reason`; registra la petición sin resolver la
  solicitud.
- `POST /admin/admin-role-requests/:requestId/approve` o `/reject`: solo
  `adminRequests.resolve`, body `reason`; aprobar promueve en la misma
  operación lógica y revoca sesiones.

Auditoría y ajustes:

- `GET /admin/audit`: filtros `actorUserId`, `role`, `action`,
  `resourceType`, `requestId`, `from`, `to`, `page` y `pageSize`. Un admin
  queda limitado a su auditoría; el superadmin usa `audit.readAll`.
- `GET /admin/settings`: solo `settings.read`.
- `PATCH /admin/settings`: `key`, `value`, `reason`; solo
  `settings.update`. Las claves admitidas son
  `incidentConfirmationThreshold` e `incidentMatchWindowMinutes`.

Los errores de autorización usan `ADMIN_AUTH_REQUIRED` (`401`) o
`INSUFFICIENT_ADMIN_PERMISSION` (`403`). Una colisión de versión, bloqueo activo o
transición incompatible responde `409`; no debe reintentarse una mutación
automáticamente sin volver a consultar el recurso.

### Incidentes

- `GET /incidents/types`: `200` con códigos, nombres y severidades.
- `POST /incidents/reports`: Bearer; body de reporte completo; `201`.
  Errores `400`, `404`, `409`, `422`, `429`.
- `GET /incidents`: query obligatoria `cityId`; opcionales `incidentType`,
  `from`, `to`, `page`, `pageSize`; `200` paginado.
- `GET /incidents/nearby`: query `cityId`, `latitude`, `longitude`; opcionales
  `radiusMeters`, `limit`, `incidentType`; `200`.
- `GET /incidents/:incidentId`: ObjectId; solo estados visibles; `200` o
  `404`.
- `PATCH /incidents/:incidentId`: Bearer del autor; body parcial de título,
  descripción, fecha, coordenadas, dirección o barrio; `200`, `403`, `409`.
- `DELETE /incidents/:incidentId`: Bearer del autor; solo pendiente; `204`.
- `POST /incidents/:incidentId/confirm`: Bearer; sin body; `200`; `409` al
  repetir.
- `DELETE /incidents/:incidentId/confirm`: Bearer; sin body; `204`.
- `GET /admin/incidents`: Admin; cola paginada. `status=pending`,
  `sortBy=createdAt&sortOrder=asc` obtiene los casos más antiguos primero.
- `GET /admin/incidents/:incidentId`: detalle, fuentes, versión y bloqueo.
- `POST /admin/incidents`: Admin; mismo cuerpo base; `201` como
  `admin_verified`.
- `PATCH /admin/incidents/:incidentId`: body parcial, `reason` y
  `expectedUpdatedAt`; puede corregir tipo, fuente y ubicación.
- `POST /admin/incidents/:incidentId/approve`: body `reason`, `sourceUrls`,
  `corrections` y `expectedUpdatedAt`; no necesita tres confirmaciones.
- `POST /admin/incidents/:incidentId/reject`: body `reasonCode`, `reason` y
  `expectedUpdatedAt`; no incrementa estadísticas.
- `POST /admin/incidents/:incidentId/merge`: Admin; body
  `secondaryIncidentId`, `reason`, `expectedUpdatedAt` y
  `secondaryExpectedUpdatedAt`; `200`, `404`, `409`.
- `POST /admin/incidents/:incidentId/review-lock`: body
  `expectedUpdatedAt`, `ttlSeconds`; reclama una revisión.
- `DELETE /admin/incidents/:incidentId/review-lock`: body
  `expectedUpdatedAt` y `reason` opcional; libera el bloqueo.

Ejemplo:

```bash
curl -X POST http://localhost:3010/api/v1/incidents/reports \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "cityId":"64b000000000000000000001",
    "incidentType":"robo",
    "title":"Robo en transporte publico",
    "description":"Descripcion de lo ocurrido",
    "occurredAt":"2026-07-26T18:30:00.000Z",
    "latitude":4.711,
    "longitude":-74.0721
  }'
```

### Geolocalización

- `GET /geolocation/cities`: `200` con ciudades activas; permite obtener
  `cityId`, límite, centro, bounds y atribución sin acceder directamente a
  MongoDB.
- `GET /geolocation/config`: `200` con resolución base, resoluciones H3
  habilitadas, escala de color y orden de coordenadas.
- `GET /geolocation/cell`: query `latitude`, `longitude`, `resolution`;
  `200`, `400`, `422`.
- `GET /geolocation/heatmap`: query `cityId`, `resolution`, `north`, `south`,
  `east`, `west`; `incidentType` opcional. Sin `month`, usa la ventana móvil
  anual predeterminada; `month=YYYY-MM` permite consultar un mes histórico.
- `GET /geolocation/hexagons/:h3Index`: param H3 y query `cityId`; usa la misma
  ventana anual. `month=YYYY-MM` es opcional para el histórico mensual;
  `200`, `400`, `404`, `422`.
- `GET /geolocation/hexagons/:h3Index/statistics`: param H3; filtros
  opcionales `cityId`, `from`, `to`, `incidentType`, `timezone`, `groupBy`;
  combina todos los agregados del hexágono.

Ejemplo:

```bash
curl 'http://localhost:3010/api/v1/geolocation/heatmap?cityId=ID&resolution=9&north=4.9&south=4.4&east=-73.8&west=-74.4'
```

### Estadísticas

- `GET /statistics/overview`: resumen, método de validación, primera y última
  fecha, frescura y comparación con el periodo anterior.
- `GET /statistics/timeseries`: requiere solo los filtros deseados; `groupBy`
  toma `year`, `month`, `day` u `hour`.
- `GET /statistics/hourly`: devuelve 24 elementos y señala horas de mayor y
  menor cantidad, total y promedio.
- `GET /statistics/types`: devuelve cantidad, porcentaje, nombre y severidad
  de cada categoría.

Los cuatro aceptan opcionalmente `cityId`, `h3Index`, `from`, `to`,
`incidentType` y `timezone`. Ejemplos:

```bash
curl 'http://localhost:3010/api/v1/statistics/timeseries?cityId=ID&from=2026-01-01T00%3A00%3A00.000Z&to=2027-01-01T00%3A00%3A00.000Z&groupBy=month&timezone=America%2FBogota'

curl 'http://localhost:3010/api/v1/geolocation/hexagons/8966e42888fffff/statistics?cityId=ID&groupBy=day'
```

### Foro

- `POST /posts`: Bearer; body `title`, `content`, `tags` y
  `relatedIncidentId` opcional; `201`, `400`, `404`.
- `GET /posts`: query `page`, `pageSize`, `tag`, `relatedIncidentId`; `200`
  paginado.
- `GET /posts/:postId`: `200`, `400`, `404`.
- `PATCH /posts/:postId`: Bearer del autor; body parcial; `200`, `403`.
- `DELETE /posts/:postId`: Bearer del autor; `204`, `403`.
- `POST /posts/:postId/comments`: Bearer; body `content` y
  `parentCommentId` opcional; `201`, `404`.
- `GET /posts/:postId/comments`: query `page`, `pageSize`; `200` paginado.
- `PATCH /comments/:commentId`: Bearer del autor; body `content`; `200`,
  `403`.
- `DELETE /comments/:commentId`: Bearer del autor; `204`, `403`.
- `POST /posts/:postId/reactions`: Bearer; body `reactionType`; `201`, `409`.
- `DELETE /posts/:postId/reactions/:reactionType`: Bearer; `204`.
- `POST /comments/:commentId/reactions`: Bearer; body `reactionType`; `201`,
  `409`.
- `DELETE /comments/:commentId/reactions/:reactionType`: Bearer; `204`.
- `GET /admin/posts`, `GET /admin/posts/:postId`: lista y contexto completo.
- `PATCH /admin/posts/:postId`: campos editables más `reason`.
- `POST /admin/posts/:postId/hide` o `/restore`: body `reason`.
- `DELETE /admin/posts/:postId`: body `reason`; borrado lógico.
- `GET /admin/comments`, `GET /admin/comments/:commentId`: lista y contexto.
- `PATCH /admin/comments/:commentId`: `content` corregido y `reason`.
- `POST /admin/comments/:commentId/hide` o `/restore`: body `reason`.
- `DELETE /admin/comments/:commentId`: body `reason`; borrado lógico.

Las rutas `PATCH /admin/posts/:postId/status` y
`PATCH /admin/comments/:commentId/status` se mantienen como compatibilidad
transitoria; las acciones explícitas `hide`/`restore` son las recomendadas.

Reacciones válidas: `like`, `helpful`, `concerned`.

### Tiempo real

- `GET /events/stream`: header `Accept: text/event-stream`; query opcional
  `clientId` y `lastEventId`; `200`, `400`, `429`.
- `GET /admin/events/stream`: mismo contrato de transporte, Bearer admin y
  solo eventos administrativos; `200`, `401`, `403`, `429`.
- En reconexión puede enviarse `Last-Event-ID` o `lastEventId` para
  `EventSource`; si llegan ambos se usa el header.

Ejemplo:

```bash
curl -N \
  -H 'Accept: text/event-stream' \
  -H 'Last-Event-ID: UUID_PREVIO' \
  'http://localhost:3010/api/v1/events/stream?clientId=cliente-web-1'

curl -N \
  -H 'Accept: text/event-stream' \
  'http://localhost:3010/api/v1/events/stream?clientId=cliente-web-1&lastEventId=UUID_PREVIO'
```

## Pruebas

Unitarias:

```bash
pnpm test:unit
```

Integración MongoDB:

```bash
MONGODB_TEST_URI='mongodb://...' pnpm test:integration
```

E2E:

```bash
MONGODB_TEST_URI='mongodb://...' pnpm test:e2e
```

Suite completa:

```bash
MONGODB_TEST_URI='mongodb://...' pnpm test
```

Las bases reservadas son `ciudadaniaseguraya_test_integration` y
`ciudadaniaseguraya_test_e2e`. No apuntes `MONGODB_TEST_URI` a una cuenta sin
permisos o a un clúster donde esos nombres se usen para datos reales.

Si MongoDB corre localmente pero la URI configurada usa un host público, se
puede usar `MONGODB_TEST_LOCALHOST=true`; conserva las credenciales y cambia
solo el host a `127.0.0.1`.

La suite cubre:

- Registro, duplicados, login, Google Identity, vinculación segura, cookies,
  refresh y suspensión.
- Login administrativo aislado para admin/superadmin, rechazo de usuarios,
  cuenta suspendida, retraso/bloqueo, refresh, logout y cookie dedicada.
- Matriz RBAC, guardas de permisos, promoción/degradación, protección del
  superadmin bootstrap, revocación de sesiones y solicitudes administrativas.
- Coordenadas, H3, reporte, tres usuarios, idempotencia y estadísticas.
- Límites reales de Bogotá, contrato público del mapa, H3 4–9, backfill
  idempotente y eventos granulares de heatmap.
- Pipelines estadísticos, filtros públicos, rangos, zonas horarias, series,
  24 horas, categorías con cero y composición por hexágono.
- Cola administrativa ascendente, aprobación/rechazo con versión optimista,
  bloqueo concurrente, edición, creación validada y fusión.
- Propiedad y moderación lógica de posts/comentarios, auditoría y reacción
  duplicada.
- Conexión SSE pública/administrativa, aislamiento de eventos, replay, evento
  vivo y limpieza.
- Inicializador doble, unicidad, TTL y `2dsphere`.

## Postman

Archivos:

- `postman/ciudadaniasegurayaBE.postman_collection.json`
- `postman/ciudadaniasegurayaBE.local.postman_environment.json`

Importa ambos archivos, selecciona `ciudadaniasegurayaBE local` y completa
`adminIdentifier`/`adminPassword` y
`superadminIdentifier`/`superadminPassword` únicamente en tu environment
local. No guardes ni exportes ese environment con valores reales.

La carpeta `Auth` crea un usuario sintético y guarda `accessToken` y
`normalUserId`. `Geolocation > List cities` guarda `cityId`; los flujos de
incidentes, posts, comentarios y solicitudes guardan `incidentId`, `postId`,
`commentId` y `adminRequestId`. Los logins administrativos guardan
`adminAccessToken`, `superadminAccessToken` y los IDs correspondientes.
Postman mantiene `csy_refresh` y `csy_admin_refresh` en su cookie jar.

Las carpetas administrativas son:

- `Admin Authentication`
- `Admin Dashboard`
- `Admin Users`
- `Administrators`
- `Admin Role Requests`
- `Incident Moderation`
- `Post Moderation`
- `Comment Moderation`
- `Audit`
- `Admin Settings`
- `Admin Realtime`

Incluyen ejemplos positivos y negativos: login de ambos roles, intento de
promoción por admin con `403`, promoción por superadmin, intento de modificar
otro admin con `403`, solicitud/aprobación de rol, aprobación de incidente,
borrado lógico y consulta de auditoría. Las mutaciones que eliminan, promueven,
degradan o resuelven una solicitud deben ejecutarse sobre datos desechables y
en el orden descrito en [docs/admin-api.md](./docs/admin-api.md).

Para regenerar los archivos después de cambiar rutas:

```bash
pnpm postman:generate
```

No hay credenciales reales en la colección.

## Decisiones técnicas

- Refresh token opaco en vez de un segundo JWT: permite revocación y rotación
  claras; `JWT_REFRESH_SECRET` se usa como clave HMAC.
- Google entrega identidad, no una sesión paralela: después de verificar el ID
  token se emiten el mismo access JWT y la misma cookie de refresh del backend.
- Reporter e incidente consolidado son documentos distintos para correlacionar
  varias fuentes sin exponer identidades.
- El mapa anual agrega directamente los incidentes públicos del último año
  para que cada registro expire en su aniversario; los agregados H3 mensuales
  se conservan para consultas históricas explícitas.
- Las estadísticas temporales usan agregaciones MongoDB sobre incidentes
  validados; no descargan incidentes para agregarlos en el cliente.
- Bus en memoria detrás de una interfaz por tratarse inicialmente de una sola
  instancia.
- Borrado lógico para contenido e incidentes, y anonimización irreversible
  para cuentas.
- Sin Redis, microservicios, Mongoose, Express, TypeScript ni CommonJS.
