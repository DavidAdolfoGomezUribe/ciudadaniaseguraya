> 08/30/2026 11:11 AM — Superadmin Agent Operations View

The administrative application now includes a single superadmin-only agent view with service health, OpenAI/Ollama switching, installed Ollama model selection, a 1–100 article limit, explicit backend-write approval, run counters, cancellation, and polled operational logs. All requests pass through the authenticated backend; no agent credential is compiled into the frontend.

Evidence: 139 frontend tests and lint passed, the production build generated `/admin/agent`, and the Docker image served that route with the expected security headers.

---

# Ciudadanía Segura Ya — Frontend

Frontend web de Ciudadanía Segura Ya, una plataforma para explorar la
distribución de incidentes de seguridad validados mediante un mapa de Colombia
basado en celdas H3. El proyecto usa JavaScript, Next.js App Router y un backend
Fastify/MongoDB independiente.

> Azul significa **sin registros validados para el periodo consultado**. No
> significa que una zona sea segura ni reemplaza fuentes oficiales, una
> denuncia o un servicio de emergencia.

## 1. Descripción

La aplicación presenta:

- una landing pública con una explicación del sistema;
- un mapa de calles OpenStreetMap con hexágonos H3 de deck.gl, acotado a Colombia;
- una cuadrícula H3 que también muestra celdas sin incidentes;
- filtros por ciudad, mes y categoría;
- detalle y estadísticas de un hexágono seleccionado;
- gráficas agregadas por año, mes, día, hora y tipo;
- actualizaciones selectivas mediante Server-Sent Events (SSE);
- registro e inicio de sesión local;
- un formulario autenticado para reportar incidentes;
- acceso administrativo aislado, panel protegido y controles por permisos;
- gestión y moderación administrativa sin persistir tokens ni datos sensibles;
- páginas de cuenta, privacidad y términos.

Los reportes no se muestran automáticamente como hechos confirmados. El
backend aplica correlación, validación comunitaria o administrativa y solo
publica en el mapa los estados validados.

## 2. Objetivo

El objetivo es facilitar la lectura espacial y temporal de información
ciudadana validada sin:

- presentar ausencia de datos como una garantía;
- publicar la identidad de quien reporta;
- exponer coordenadas exactas de categorías sensibles;
- descargar todos los incidentes para agregar datos en el navegador;
- bloquear el hilo principal al generar la cuadrícula H3;
- depender de Google Maps para la visualización pública principal.

La interfaz prioriza contexto, accesibilidad, rendimiento, trazabilidad de
errores y degradación progresiva.

## 3. Tecnologías

El proyecto es ESM y contiene únicamente JavaScript/JSX.

### Dependencias de ejecución

| Tecnología           |   Versión | Responsabilidad                                   |
| -------------------- | --------: | ------------------------------------------------- |
| Next.js              | `16.2.10` | App Router, renderizado, metadatos, rutas y build |
| React / React DOM    |  `19.2.7` | Interfaz y límites cliente                        |
| Zod                  |   `4.4.3` | Variables, formularios y contratos HTTP           |
| React Hook Form      |  `7.82.0` | Estado y envío de formularios                     |
| Hookform resolvers   |   `5.4.0` | Integración Zod–React Hook Form                   |
| TanStack Query       | `5.101.2` | Datos remotos, caché y mutaciones                 |
| Query Persist Client | `5.101.2` | Persistencia selectiva de consultas públicas      |
| idb-keyval           |   `6.3.0` | Adaptador IndexedDB                               |
| MapLibre GL          |  `5.24.0` | Renderizador WebGL de teselas OpenStreetMap       |
| react-map-gl         |   `8.1.1` | Integración React del renderizador cartográfico   |
| deck.gl              |   `9.3.7` | Capas H3 y GeoJSON aceleradas con WebGL           |
| h3-js                |   `4.5.0` | Índices, padres y cuadrícula H3                   |
| Recharts             |   `3.9.2` | Gráficas agregadas                                |
| Google Maps React    |   `1.9.0` | Selector de ubicación del formulario              |
| Zustand              |  `5.0.14` | Estado pequeño de interfaz y mapa                 |
| date-fns             |   `4.4.0` | Utilidades de fecha                               |
| Lucide React         |  `1.25.0` | Iconos vectoriales                                |

### Dependencias de desarrollo

| Tecnología                  |                       Versión | Responsabilidad                          |
| --------------------------- | ----------------------------: | ---------------------------------------- |
| Vitest                      |                      `4.1.10` | Pruebas unitarias y de componentes       |
| Testing Library             |                      `16.3.2` | Pruebas desde la perspectiva del usuario |
| jest-dom / user-event / DOM | `6.9.1` / `14.6.1` / `10.4.1` | Matchers e interacción                   |
| jsdom                       |                      `29.1.1` | Entorno DOM de Vitest                    |
| Playwright                  |                      `1.61.1` | Pruebas de flujo en navegador            |
| MSW                         |                      `2.15.0` | Infraestructura para mocks HTTP          |
| ESLint / eslint-config-next |          `9.39.5` / `16.2.10` | Análisis estático                        |
| Prettier                    |                       `3.9.5` | Formato                                  |
| Tailwind CSS                |                      `3.4.19` | Utilidades de estilo                     |
| PostCSS / Autoprefixer      |           `8.5.19` / `10.5.4` | Procesamiento CSS                        |

Todas las versiones están fijadas exactamente; no se usan rangos `^` ni `~`.

## 4. Requisitos

- Node.js `24.x`; `.node-version` y `engines.node` fijan el mismo major LTS.
- Corepack disponible.
- pnpm `11.1.3`.
- Backend Ciudadanía Segura Ya accesible; localmente se espera
  `http://localhost:3010`.
- Navegador moderno con ES modules, IndexedDB, Web Workers y WebGL.
- Para E2E: navegador Playwright instalado.
- Opcionalmente:
  - un proveedor de teselas OSM propio o comercial para tráfico alto;
  - Google Maps JavaScript API + Places para seleccionar ubicaciones;

Puertos locales predeterminados:

| Servicio        | URL                                          |
| --------------- | -------------------------------------------- |
| Frontend        | `http://localhost:3001`                      |
| Backend         | `http://localhost:3010`                      |
| OpenAPI backend | `http://localhost:3010/docs/json`            |
| SSE             | `http://localhost:3010/api/v1/events/stream` |

## 5. Instalación con pnpm

pnpm es el único gestor admitido. No regeneres el lockfile con npm, Yarn o
Bun. Antes de instalar, revisa la cuarentena de scripts de la sección 7.

```bash
cd /ruta/al/repositorio/ciudadaniasegurayaFE
corepack enable
corepack prepare pnpm@11.1.3 --activate
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Comprueba el entorno:

```bash
node --version
pnpm --version
pnpm ignored-builds
```

El lockfile `pnpm-lock.yaml` debe permanecer versionado. En CI y Vercel usa
siempre:

```bash
pnpm install --frozen-lockfile
```

## 6. Corepack

`package.json` fija:

```json
{
  "packageManager": "pnpm@11.1.3"
}
```

Activa exactamente esa versión:

```bash
corepack enable
corepack prepare pnpm@11.1.3 --activate
pnpm --version
```

El resultado esperado del último comando es `11.1.3`. Si el sistema no incluye
Corepack, instálalo mediante el mecanismo oficial de tu distribución de Node y
vuelve a ejecutar los comandos; no sustituyas pnpm por otro gestor.

## 7. Política de siete días y cuarentena de scripts

`pnpm-workspace.yaml` aplica:

```yaml
minimumReleaseAge: 10080
minimumReleaseAgeStrict: true
minimumReleaseAgeIgnoreMissingTime: false
trustPolicy: no-downgrade
blockExoticSubdeps: true
```

`10080` son siete días en minutos. Una dependencia nueva no debe instalarse
antes de cumplir esa antigüedad; tampoco se admiten subdependencias exóticas ni
una degradación de confianza. Antes de actualizar:

1. justifica la dependencia;
2. comprueba compatibilidad con ESM, navegador, Node, Next.js y Vercel;
3. verifica que no duplique una capacidad existente;
4. revisa publicación, procedencia, changelog y scripts de instalación;
5. modifica versiones exactas y lockfile en el mismo cambio;
6. ejecuta lint, pruebas y build.

La política actual mantiene explícitamente bloqueados estos scripts:

| Paquete         | Versión resuelta | Estado    | Nota                                                  |
| --------------- | ---------------: | --------- | ----------------------------------------------------- |
| `msw`           |         `2.15.0` | Bloqueado | Las pruebas actuales no dependen de su postinstall    |
| `sharp`         |         `0.34.5` | Bloqueado | No se usa `next/image`; Next funciona con su fallback |
| `unrs-resolver` |         `1.12.2` | Bloqueado | El lint/build actual funciona sin aprobar su script   |

Verifica la cuarentena con:

```bash
pnpm ignored-builds
```

No ejecutes `pnpm approve-builds` de forma indiscriminada. Los valores actuales
de `allowBuilds` son decisiones booleanas `false`. Para mantener todo
bloqueado:

```yaml
allowBuilds:
  msw: false
  sharp: false
  unrs-resolver: false
```

Solo después de revisar un paquete concreto puede marcarse como `true` y
reconstruirse únicamente ese paquete. Ejemplo, si una futura funcionalidad
requiere `sharp`:

```bash
pnpm rebuild sharp
pnpm ignored-builds
pnpm build
```

El `true` correspondiente debe quedar revisado y versionado antes de
`pnpm rebuild sharp`. Que un paquete esté fijado no constituye por sí mismo una
aprobación de su script.

## 8. Variables de entorno

Copia `.env.example` a `.env.local`:

```env
NEXT_PUBLIC_APP_NAME=Ciudadania Segura Ya
NEXT_PUBLIC_APP_URL=http://localhost:3001
NEXT_PUBLIC_ADMIN_LOGIN_PATH=/login/admin
NEXT_PUBLIC_ADMIN_DASHBOARD_PATH=/admin

NEXT_PUBLIC_API_BASE_URL=http://localhost:3010
NEXT_PUBLIC_SSE_URL=http://localhost:3010/api/v1/events/stream

NEXT_PUBLIC_MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
NEXT_PUBLIC_DEFAULT_CITY_ID=
NEXT_PUBLIC_DEFAULT_CITY_SLUG=bogota

NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=

NEXT_PUBLIC_MAP_MIN_ZOOM=4.5
NEXT_PUBLIC_MAP_MAX_ZOOM=17
NEXT_PUBLIC_H3_MAX_VISIBLE_CELLS=12000

NEXT_PUBLIC_CACHE_VERSION=1
NEXT_PUBLIC_CACHE_BUILD_ID=local
NEXT_PUBLIC_CACHE_MAX_AGE_MS=86400000
```

| Variable                           | Uso                                      |
| ---------------------------------- | ---------------------------------------- |
| `NEXT_PUBLIC_APP_NAME`             | Nombre visible de la aplicación          |
| `NEXT_PUBLIC_APP_URL`              | Origen canónico y metadatos              |
| `NEXT_PUBLIC_ADMIN_LOGIN_PATH`     | Ruta configurable del acceso admin       |
| `NEXT_PUBLIC_ADMIN_DASHBOARD_PATH` | Ruta configurable del panel admin        |
| `NEXT_PUBLIC_API_BASE_URL`         | Origen HTTP del backend                  |
| `NEXT_PUBLIC_SSE_URL`              | Endpoint SSE absoluto                    |
| `NEXT_PUBLIC_MAP_TILE_URL`         | Plantilla HTTPS de teselas OpenStreetMap |
| `NEXT_PUBLIC_DEFAULT_CITY_ID`      | ObjectId preferido, opcional             |
| `NEXT_PUBLIC_DEFAULT_CITY_SLUG`    | Fallback para elegir ciudad              |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`  | Clave pública restringida por referrer   |
| `NEXT_PUBLIC_MAP_MIN_ZOOM`         | Zoom mínimo, entre 0 y 20                |
| `NEXT_PUBLIC_MAP_MAX_ZOOM`         | Zoom máximo, superior al mínimo          |
| `NEXT_PUBLIC_H3_MAX_VISIBLE_CELLS` | Límite del worker, de 100 a 50.000       |
| `NEXT_PUBLIC_CACHE_VERSION`        | Versión lógica de datos persistidos      |
| `NEXT_PUBLIC_CACHE_BUILD_ID`       | Identificador de build para invalidación |
| `NEXT_PUBLIC_CACHE_MAX_AGE_MS`     | Vida máxima, mínimo 60.000 ms            |

Las variables se validan con Zod al cargar el módulo de configuración. Un
valor inválido detiene el build o el arranque con los nombres de los campos
afectados.

Todo valor `NEXT_PUBLIC_*` es visible en el navegador. Nunca guardes aquí:

- secretos OAuth;
- secretos JWT;
- contraseñas;
- tokens o cookies;
- credenciales administrativas o de MongoDB;
- claves privadas del backend.

## 9. Ejecución local

Con el backend ya disponible:

```bash
cd /ruta/al/repositorio/ciudadaniasegurayaFE
pnpm dev
```

Abre `http://localhost:3001`. El acceso administrativo común para `admin` y
`superadmin` está en `http://localhost:3001/login/admin`; una cuenta `user` no
puede completar ese login.

Para probar el modo de producción local:

```bash
pnpm build
pnpm start
```

Comprobaciones rápidas:

```bash
curl --fail http://localhost:3010/health
curl --fail http://localhost:3010/ready
curl --fail http://localhost:3010/docs/json
```

Scripts disponibles:

| Comando               | Acción                         |
| --------------------- | ------------------------------ |
| `pnpm dev`            | Next.js en desarrollo          |
| `pnpm build`          | Build de producción            |
| `pnpm start`          | Sirve el build                 |
| `pnpm lint`           | ESLint sin warnings permitidos |
| `pnpm format`         | Formatea el proyecto           |
| `pnpm format:check`   | Comprueba formato              |
| `pnpm test`           | Vitest una vez                 |
| `pnpm test:watch`     | Vitest interactivo             |
| `pnpm test:e2e`       | Playwright headless            |
| `pnpm test:e2e:ui`    | Playwright con UI              |
| `pnpm check:contract` | Comprueba OpenAPI del backend  |

## 10. Conexión con el backend

### Desarrollo

En dos terminales:

```bash
# Terminal 1
cd ../ciudadaniasegurayaBE
corepack enable
corepack prepare pnpm@11.1.3 --activate
pnpm install --frozen-lockfile
pnpm db:init
pnpm dev
```

```bash
# Terminal 2
cd ../ciudadaniasegurayaFE
pnpm dev
```

El backend local debe admitir el origen del frontend:

```env
CORS_ORIGINS=http://localhost:3001
REFRESH_COOKIE_SAME_SITE=strict
REFRESH_COOKIE_SECURE=false
REFRESH_COOKIE_DOMAIN=
```

El cliente usa `credentials: "include"` en todas las solicitudes. El access
token viaja por `Authorization`; el refresh token permanece en una cookie
HttpOnly del backend.

### Topología de producción recomendada

```text
https://app.ejemplo.com  ─────►  https://api.ejemplo.com
       Vercel                       Fastify/MongoDB
```

Ambos orígenes son HTTPS y pertenecen al mismo sitio registrable. Configuración
backend recomendada:

```env
NODE_ENV=production
PUBLIC_API_BASE_URL=https://api.ejemplo.com
CORS_ORIGINS=https://app.ejemplo.com
REFRESH_COOKIE_SAME_SITE=strict
REFRESH_COOKIE_SECURE=true
REFRESH_COOKIE_DOMAIN=
```

La cookie host-only debe quedar sin `REFRESH_COOKIE_DOMAIN`. Si frontend y API
permanecen en sitios distintos —por ejemplo `*.vercel.app` y otro proveedor— se
requiere:

```env
REFRESH_COOKIE_SAME_SITE=none
REFRESH_COOKIE_SECURE=true
```

Ese escenario convierte la cookie en third-party para algunos navegadores y
puede ser bloqueado. Los dominios propios bajo el mismo sitio son la opción más
robusta.

Para previews de Vercel, el backend debe permitir únicamente el patrón del
proyecto/equipo, nunca `https://*.vercel.app`:

```env
CORS_ORIGIN_PATTERNS=https://ciudadaniasegurayafe-*-mi-equipo.vercel.app
```

Comprueba el contrato con el backend iniciado:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:3010 pnpm check:contract
```

## 11. Mapa H3

El mapa público combina:

- OpenStreetMap para calles, carreras, avenidas y navegación contextual;
- MapLibre GL como renderizador WebGL local del mapa base;
- deck.gl para la capa H3 y el límite;
- `H3HexagonLayer` para celdas uniformes;
- un Web Worker para generar la cuadrícula visible;
- estadísticas agregadas del backend;
- `public/data/colombia-boundary-simplified.geojson` para recorte.

El límite de Colombia procede de Natural Earth Admin 0, escala 1:110m,
versión 5.1.1, dominio público, consultado el 2026-07-26. La transformación y
limitaciones están documentadas en
`public/data/colombia-boundary-SOURCE.md`. Es un límite de visualización, no
catastral.

El flujo es:

```text
moveend/debounce
→ normalizar viewport
→ calcular resolución
→ generar H3 visible en worker
→ limitar al polígono y al máximo de celdas
→ consultar agregados del backend
→ completar celdas ausentes con valor 0
→ renderizar deck.gl
```

El mapa:

- tiene `maxBounds` de Colombia;
- no solicita datos en cada frame;
- requiere activación explícita antes de capturar gestos;
- mantiene el resultado anterior mientras cambia la consulta;
- muestra fallback si no existe WebGL;
- permite seleccionar un hexágono mediante `?hex=...`;
- usa la escala publicada por `/api/v1/geolocation/config`, con fallback local.

GeoJSON usa `[longitud, latitud]`; H3 usa
`latLngToCell(latitud, longitud, resolución)`.

## 12. Resoluciones por zoom

La resolución se centraliza en
`src/features/map/utils/resolution-by-zoom.js`:

|         Zoom | Resolución H3 |
| -----------: | ------------: |
|        `< 6` |             4 |
|   `6 – 7.99` |             5 |
|   `8 – 9.99` |             6 |
| `10 – 11.99` |             7 |
| `12 – 13.99` |             8 |
|      `>= 14` |             9 |

El backend debe tener:

```env
H3_BASE_RESOLUTION=9
H3_SUPPORTED_RESOLUTIONS=4,5,6,7,8,9
```

Si el worker supera `NEXT_PUBLIC_H3_MAX_VISIBLE_CELLS`, reduce temporalmente
la resolución y comunica `resolutionAdjusted`. Nunca genera toda Colombia a
resolución 9. Todas las celdas de una capa usan una única resolución.

Después de ampliar un backend existente a `4,5,6,7,8,9`, ejecuta una
vez, en ventana de mantenimiento:

```bash
cd ../ciudadaniasegurayaBE
pnpm db:init
pnpm db:backfill:geospatial
```

El backfill es idempotente: recalcula `h3Cells`, sincroniza
`statisticsApplied` y reconstruye `hex_monthly_stats`.

## 13. Caché por viewport

Las consultas remotas pertenecen a TanStack Query, no a Zustand. La clave del
heatmap incluye:

```text
cityId + mes + resolución + viewport normalizado + tipo de incidente
```

El viewport:

- se confirma 400 ms después del movimiento;
- se limita al bounding box de Colombia;
- se redondea a dos decimales;
- incorpora margen para reutilizar datos entre movimientos pequeños;
- no habilita la consulta cuando no intersecta Colombia.

Configuración predeterminada:

| Parámetro           |                              Valor |
| ------------------- | ---------------------------------: |
| `staleTime` público |                         10 minutos |
| `gcTime` público    |                           24 horas |
| reintentos          | máximo 2 para errores recuperables |
| refetch al enfocar  |                        desactivado |
| refetch al montar   |                        desactivado |
| polling             |                        desactivado |

No se reintentan automáticamente `400`, `401`, `403`, `404` ni `422`. El mapa
usa `keepPreviousData` para evitar parpadeos al cambiar viewport o resolución.
SSE mantiene los datos recientes sin polling global.

## 14. IndexedDB

`PersistQueryClientProvider` persiste únicamente consultas exitosas con
`meta.persist === true`. La entrada se guarda bajo:

```text
csy-public-query-cache
```

Incluye:

- versión de caché;
- identificador de build;
- fecha de guardado;
- estado público deshidratado de TanStack Query.

Se descarta cuando cambia `NEXT_PUBLIC_CACHE_VERSION`,
`NEXT_PUBLIC_CACHE_BUILD_ID` o se supera
`NEXT_PUBLIC_CACHE_MAX_AGE_MS` —24 horas por defecto—.

No se persisten:

- access tokens;
- refresh tokens o cookies;
- contraseñas;
- datos privados de cuenta;
- formularios de incidentes.

Si IndexedDB está bloqueado, lleno, corrupto o no existe, la aplicación elimina
lo recuperable y continúa con caché en memoria. La persistencia nunca debe
impedir el arranque.

## 15. Server-Sent Events

El cliente abre una conexión pública a:

```text
GET /api/v1/events/stream
```

Comportamiento implementado:

- una conexión por instancia de `RealtimeProvider`;
- `clientId` aleatorio por pestaña;
- estado `connecting`, `online` u `offline`;
- limpieza al desmontar;
- backoff exponencial desde 1 s hasta 30 s, con jitter;
- deduplicación de los últimos 500 IDs;
- último ID en memoria;
- replay por query `lastEventId`, necesario porque `EventSource` no permite
  definir `Last-Event-ID` manualmente;
- tolerancia a eventos JSON malformados.

El backend acepta tanto el header `Last-Event-ID` como `lastEventId`; el header
tiene prioridad. El historial backend es acotado y en memoria, por lo que el
replay es best effort, no una cola duradera.

Eventos escuchados:

```text
system.connected
incident.created
incident.updated
incident.community_confirmed
incident.admin_verified
incident.rejected
incident.merged
heatmap.updated
```

## 16. Selección de actualizaciones relevantes

Ante `heatmap.updated`, el frontend compara:

1. ciudad activa;
2. mes activo;
3. resolución;
4. H3 visible o su padre a la resolución visible;
5. filtro de categoría;
6. conjunto de índices del viewport.

El payload granular incluye por celda:

```text
month
resolution
h3Index
incidentType
incidentCount / level / color
incidentTypeCount / incidentTypeLevel / incidentTypeColor
incidentTypes
lastUpdatedAt
```

Si la actualización coincide, se modifica únicamente el caché correspondiente
con `setQueriesData`. Para un filtro por categoría se usan los valores
específicos de esa categoría; sin filtro se usan los totales. Un payload
antiguo sin `updates` invalida solo la consulta de ciudad, periodo y resolución
afectada.

Los eventos fuera del viewport no recargan el mapa: se agregan al panel de
novedades. La aplicación no invalida todas las consultas por cualquier evento.

## 17. Autenticación

Flujos disponibles:

- registro con usuario, correo, contraseña y aceptación de términos;
- login con correo o username;
- restauración de sesión;
- refresh automático;
- logout;
- acceso protegido a `/cuenta` y `/reportar-incidente`;
- retorno seguro a una ruta local después del login.

Modelo de sesión:

```text
access token  → solo memoria JavaScript
refresh token → cookie HttpOnly gestionada por el backend
```

El access token no se guarda en `localStorage`, `sessionStorage` ni IndexedDB.
El cliente:

- añade `Authorization: Bearer` cuando existe token;
- incluye cookies con `credentials: "include"`;
- ante un `401`, ejecuta un único refresh compartido;
- reintenta la petición original una sola vez;
- limpia memoria si el refresh falla;
- valida la respuesta de sesión con Zod.

Las restricciones visuales no sustituyen autorización. El backend vuelve a
verificar sesión, rol, origen y estado del usuario en cada operación protegida.

## 18. Acceso local

El frontend utiliza exclusivamente registro e inicio de sesión con correo o
nombre de usuario y contraseña. Google Identity no se carga, no aparece en la
cuenta y no requiere variables públicas de configuración.

## 19. Formulario de incidentes

Ruta protegida:

```text
/reportar-incidente
```

Campos:

- ciudad y tipo;
- título y descripción;
- fecha y hora en `America/Bogota`;
- latitud y longitud;
- precisión `exact`, `approximate` o `hexagon`;
- dirección y barrio opcionales;
- URL HTTP/HTTPS opcional;
- descripción de evidencia opcional;
- confirmación explícita de la ubicación.

El frontend:

- valida longitudes, coordenadas y formato;
- impide una fecha superior a cinco minutos en el futuro;
- evita doble envío;
- convierte la fecha local de Colombia a ISO;
- muestra una vista previa H3 en resolución 9;
- advierte que el reporte queda pendiente.

El backend vuelve a calcular todos los H3 4–9, valida fecha, usuario, ciudad,
límite geográfico y duplicados. Las categorías sensibles se publican como área
H3, no como punto exacto.

Flujo:

```text
autenticación
→ formulario
→ selección y confirmación de ubicación
→ POST /api/v1/incidents/reports
→ validación backend
→ estado pendiente
→ confirmación informativa
```

## 20. Google Maps

Google Maps se usa solo en el selector de ubicación del reporte. El mapa
público principal usa calles de OpenStreetMap, renderizadas con MapLibre, y la
capa H3 de deck.gl.

Para habilitarlo:

1. configura facturación en Google Cloud;
2. habilita Maps JavaScript API y Places API;
3. crea una API key;
4. restringe la key por HTTP referrer:
   - `http://localhost:3001/*`;
   - el dominio exacto de producción;
5. restringe la key a las APIs necesarias;
6. define:

   ```env
   NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
   ```

El selector:

- carga dinámicamente y sin SSR;
- limita Places al país `CO`;
- restringe el mapa a Colombia;
- permite búsqueda, clic y arrastre del marcador;
- ofrece geolocalización solo tras una acción explícita;
- no envía la posición actual hasta confirmar y enviar el formulario;
- mantiene entrada manual de coordenadas si no existe key o falla Google.

La implementación actual usa `DEMO_MAP_ID` para `AdvancedMarker`. Antes de un
lanzamiento que requiera un Map ID propio, reemplázalo por un identificador
configurado para el proyecto de Google Maps y vuelve a validar CSP, referrers y
facturación.

## 21. Privacidad

Principios implementados:

- no se publica identidad ni correo del reportante;
- no se persisten tokens en almacenamiento web;
- IndexedDB contiene exclusivamente datos públicos;
- la ubicación del navegador requiere consentimiento;
- no se envía hasta confirmar el reporte;
- se ofrecen precisión aproximada y área H3;
- las categorías sensibles no exponen un punto público exacto;
- se pide evitar nombres, documentos y datos de terceros;
- las fuentes externas solo admiten HTTP/HTTPS;
- no se incrusta HTML remoto ni previews de noticias;
- no se almacenan fotografías, thumbnails, video ni evidencia multimedia.

Las páginas `/privacidad` y `/terminos` explican el tratamiento y la naturaleza
no oficial de la información. El frontend mejora la experiencia, pero el
backend es la autoridad final para validación, anonimización y permisos.

## 22. Gráficas

Recharts presenta cinco vistas:

- incidentes por año;
- incidentes por mes;
- incidentes por día;
- incidentes por hora;
- distribución por categoría.

El alcance responde a ciudad, periodo, categoría y H3 seleccionado. Las
agregaciones se calculan en MongoDB mediante el backend; el navegador no
descarga todos los incidentes para producirlas.

Cada panel incluye:

- estado de carga;
- estado vacío;
- error con `requestId` cuando está disponible;
- resumen textual;
- gráfica sin animación;
- tabla desplegable con los mismos datos.

La tabla y el resumen son alternativas accesibles a la visualización SVG.

## 23. Loader

La landing usa un loader de arranque ligado a señales reales:

- sesión resuelta;
- mapa cargado y cuadrícula lista o degradada;
- consultas estadísticas terminadas;
- tiempo visual mínimo de 600 ms.

Muestra progreso, mensajes técnicos y `aria-live`. A los 10 segundos activa un
modo de recuperación con:

- **REINTENTAR**, que recarga;
- **CONTINUAR SIN MAPA COMPLETO**, que permite usar la interfaz disponible.

Al terminar devuelve el foco al título principal. `src/app/loading.js` cubre
transiciones de rutas. El loader usa CSS y texto, no imágenes decorativas.

## 24. Diseño visual

La dirección visual es institucional, técnica y deliberadamente sobria:

- fondos crema y paneles elevados;
- texto carbón y bordes visibles;
- sombras duras pequeñas;
- etiquetas monoespaciadas en mayúsculas;
- acentos de advertencia, información y éxito;
- escala H3 azul, verde, amarillo, naranja, rojo y negro;
- composición aproximada 25/75 entre explicación y mapa en escritorio;
- apilado responsive en pantallas pequeñas;
- iconos vectoriales Lucide;
- ausencia de fotografías y fondos raster decorativos.

Accesibilidad incluida:

- idioma `es-CO`;
- skip link;
- foco visible;
- labels y mensajes asociados;
- controles con nombres accesibles;
- alternativa textual del mapa;
- tablas para gráficas;
- soporte para `prefers-reduced-motion`;
- interfaz utilizable con zoom del navegador;
- fallback sin WebGL.

El objetivo es WCAG 2.2 AA cuando sea razonablemente posible. Cualquier cambio
de color debe volver a comprobar contraste y no depender solo del color para
comunicar estado.

## 25. Pruebas

### Comandos

```bash
pnpm lint
pnpm format:check
pnpm test
pnpm build
```

Modo interactivo:

```bash
pnpm test:watch
```

Instalación inicial de Playwright en Linux y ejecución:

```bash
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
```

UI de Playwright:

```bash
pnpm test:e2e:ui
```

Playwright está configurado para Chromium de escritorio y un perfil móvil
Pixel 7. Inicia un servidor aislado en `http://127.0.0.1:3100`. Los escenarios en `e2e/`
cubren landing/mapa y tiempo real simulado, autenticación/retorno seguro, y
reporte autenticado con geolocalización simulada. No realizan un login real de
Google ni llaman servicios externos.

Contrato backend:

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:3010 pnpm check:contract
```

El script consulta `/docs/json` y exige las 25 operaciones HTTP enumeradas en
la sección 29.

### Estado comprobado en esta entrega

- `pnpm lint`: correcto.
- `pnpm test`: correcto, 20 archivos y 117 pruebas.
- `pnpm test:e2e`: correcto, 25 escenarios y 1 omisión intencional de la
  interacción con rueda en Pixel 7.
- `pnpm build`: correcto con Next.js `16.2.10`.
- Contrato: 25 operaciones verificadas contra el OpenAPI generado por el
  backend.

El login real de Google, Google Maps con credenciales de producción y
restricciones de dominio requieren además una prueba manual. `pnpm
check:contract` se conserva para repetir la verificación contra un backend
levantado.

## 26. Despliegue en Vercel

No se necesita `vercel.json`; Vercel detecta Next.js.

1. importa el repositorio;
2. si el repositorio contiene frontend y backend, define **Root Directory**:

   ```text
   ciudadaniasegurayaFE
   ```

3. selecciona Node.js 24;
4. usa como instalación:

   ```bash
   corepack enable && corepack prepare pnpm@11.1.3 --activate && pnpm install --frozen-lockfile
   ```

5. usa como build:

   ```bash
   pnpm build
   ```

6. conserva el output predeterminado de Next.js;
7. configura por separado Development, Preview y Production.

Variables mínimas de producción:

```env
NEXT_PUBLIC_APP_URL=https://app.ejemplo.com
NEXT_PUBLIC_API_BASE_URL=https://api.ejemplo.com
NEXT_PUBLIC_SSE_URL=https://api.ejemplo.com/api/v1/events/stream
NEXT_PUBLIC_MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
NEXT_PUBLIC_DEFAULT_CITY_SLUG=bogota
NEXT_PUBLIC_MAP_MIN_ZOOM=4.5
NEXT_PUBLIC_MAP_MAX_ZOOM=17
NEXT_PUBLIC_H3_MAX_VISIBLE_CELLS=12000
NEXT_PUBLIC_CACHE_VERSION=1
NEXT_PUBLIC_CACHE_BUILD_ID=IDENTIFICADOR_UNICO_DEL_BUILD
NEXT_PUBLIC_CACHE_MAX_AGE_MS=86400000
```

Agrega Google Maps y Google Client ID solo en los ambientes donde se usarán.
No compartas credenciales sin necesidad entre Development, Preview y
Production.

Aspectos críticos:

- toda variable `NEXT_PUBLIC_*` queda integrada en el build: un cambio requiere
  redeploy;
- usa un `NEXT_PUBLIC_CACHE_BUILD_ID` nuevo para invalidar caché persistente;
- conserva la atribución visible de OpenStreetMap y respeta la política de uso
  del servidor de teselas;
- la API y SSE deben ser HTTPS para evitar mixed content;
- el backend debe permitir el origen exacto y previews controladas;
- un proxy delante de SSE no debe acumular indefinidamente el stream;
- si habilitas el selector opcional de Google Maps, restringe la clave al
  dominio de producción;
- ejecuta el backfill H3 del backend antes de habilitar vistas 5–6 sobre datos
  históricos.

Después del despliegue verifica manualmente landing, WebGL, estadísticas,
refresh tras recarga, SSE, ruta protegida y reporte.

## 27. Solución de errores frecuentes

| Síntoma                                 | Causa probable                               | Acción                                                         |
| --------------------------------------- | -------------------------------------------- | -------------------------------------------------------------- |
| pnpm usa otra versión                   | Corepack inactivo                            | Ejecuta los comandos de la sección 6                           |
| `pnpm install` informa builds ignorados | Cuarentena activa                            | Revisa sección 7; no apruebes en bloque                        |
| Build falla por variables               | URL, ObjectId, zoom o TTL inválido           | Revisa `.env.local` y la tabla de sección 8                    |
| El frontend recibe CORS                 | Origen no permitido                          | Ajusta `CORS_ORIGINS`/patrón backend                           |
| Login funciona pero refresh no          | Cookie cross-site o Secure incorrecto        | Revisa topología, SameSite, HTTPS y `credentials`              |
| Funciona local pero no en Vercel        | API HTTP, CSP, origen o variable de Preview  | Usa HTTPS y variables por ambiente                             |
| Mapa base vacío                         | URL de teselas OSM inválida o inaccesible    | Revisa `NEXT_PUBLIC_MAP_TILE_URL`, red, CSP y atribución       |
| Aparece fallback WebGL                  | GPU/WebGL no disponible                      | Habilita aceleración o usa resumen textual                     |
| Hexágonos vacíos inesperados            | Ciudad, ventana anual, viewport, H3/backfill | Comprueba query, ciudad y backfill backend                     |
| Backend responde `422` H3               | Resolución no habilitada                     | Configura 4–9 y ejecuta `db:init`                              |
| Reporte responde fuera de ciudad        | Coordenada fuera del límite real             | Corrige la selección; el backend no debe omitir esa validación |
| Google no aparece                       | Client ID o Maps key vacíos                  | Configura la variable correspondiente                          |
| Google devuelve origen inválido         | Dominio no registrado                        | Añade el origen exacto en Google Cloud                         |
| Maps carga pero Places no               | API no habilitada/restringida                | Habilita Places y revisa referrers/facturación                 |
| SSE reconecta continuamente             | API inaccesible, CORS o proxy                | Abre SSE directamente y revisa buffering/timeouts              |
| Datos antiguos tras deploy              | Buster de caché sin cambio                   | Incrementa versión o build ID                                  |
| IndexedDB falla                         | Privacidad, cuota o corrupción               | La app usa memoria; limpia almacenamiento si hace falta        |
| `check:contract` falla                  | Backend apagado o OpenAPI incompleto         | Abre `/docs/json` y revisa las operaciones faltantes           |
| Playwright no encuentra navegador       | Binario no instalado                         | Ejecuta `pnpm exec playwright install --with-deps chromium`    |

Los errores HTTP normalizados incluyen `code`, mensaje, detalles y `requestId`
cuando el backend lo envía. Las consultas no reemplazan fallos con datos
inventados.

## 28. Estructura del proyecto

```text
ciudadaniasegurayaFE/
├── e2e/
│   ├── support/
│   │   └── mock-platform.js
│   ├── auth.spec.js
│   ├── landing-map.spec.js
│   └── report.spec.js
├── public/
│   ├── data/
│   │   ├── colombia-boundary-simplified.geojson
│   │   └── colombia-boundary-SOURCE.md
│   └── manifest.webmanifest
├── scripts/
│   └── check-backend-contract.js
├── src/
│   ├── app/
│   │   ├── cuenta/
│   │   ├── login/
│   │   ├── privacidad/
│   │   ├── registro/
│   │   ├── reportar-incidente/
│   │   ├── terminos/
│   │   ├── error.js
│   │   ├── layout.js
│   │   ├── loading.js
│   │   ├── not-found.js
│   │   └── page.js
│   ├── components/
│   │   ├── feedback/
│   │   ├── forms/
│   │   ├── layout/
│   │   └── ui/
│   ├── features/
│   │   ├── auth/
│   │   ├── catalog/
│   │   ├── incidents/
│   │   ├── landing/
│   │   ├── map/
│   │   │   ├── components/
│   │   │   ├── constants/
│   │   │   ├── hooks/
│   │   │   ├── layers/
│   │   │   ├── services/
│   │   │   ├── state/
│   │   │   ├── utils/
│   │   │   └── workers/
│   │   ├── realtime/
│   │   └── statistics/
│   ├── lib/
│   │   ├── api/
│   │   ├── query/
│   │   ├── security/
│   │   ├── utils/
│   │   └── validation/
│   ├── providers/
│   ├── styles/
│   └── tests/
├── .env.example
├── eslint.config.js
├── next.config.js
├── package.json
├── playwright.config.js
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── prettier.config.js
├── tailwind.config.js
└── vitest.config.js
```

Rutas:

| Ruta                  | Acceso      |
| --------------------- | ----------- |
| `/`                   | Pública     |
| `/login`              | Pública     |
| `/registro`           | Pública     |
| `/cuenta`             | Autenticada |
| `/reportar-incidente` | Autenticada |
| `/privacidad`         | Pública     |
| `/terminos`           | Pública     |

## 29. Contratos esperados del backend

Las respuestas JSON usan:

```json
{
  "success": true,
  "data": {},
  "meta": {
    "requestId": "..."
  }
}
```

Errores:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Los datos enviados no son válidos",
    "details": []
  },
  "meta": {
    "requestId": "..."
  }
}
```

Operaciones consumidas:

| Método | Ruta                                               | Uso                                 |
| ------ | -------------------------------------------------- | ----------------------------------- |
| GET    | `/health`                                          | Proceso activo                      |
| GET    | `/ready`                                           | Dependencias listas                 |
| POST   | `/api/v1/auth/register`                            | Registro                            |
| POST   | `/api/v1/auth/login`                               | Login                               |
| POST   | `/api/v1/auth/refresh`                             | Rotar cookie HttpOnly               |
| POST   | `/api/v1/auth/logout`                              | Cerrar sesión                       |
| GET    | `/api/v1/auth/me`                                  | Perfil actual                       |
| GET    | `/api/v1/geolocation/cities`                       | Ciudades y límites                  |
| GET    | `/api/v1/geolocation/config`                       | H3 y escala                         |
| GET    | `/api/v1/geolocation/cell`                         | Calcular una celda para coordenadas |
| GET    | `/api/v1/geolocation/heatmap`                      | Agregados móviles del último año    |
| GET    | `/api/v1/geolocation/hexagons/:h3Index`            | Detalle móvil anual                 |
| GET    | `/api/v1/geolocation/hexagons/:h3Index/statistics` | Agregados del H3                    |
| GET    | `/api/v1/incidents/types`                          | Catálogo                            |
| POST   | `/api/v1/incidents/reports`                        | Crear reporte autenticado           |
| GET    | `/api/v1/incidents`                                | Listado validado                    |
| GET    | `/api/v1/incidents/:incidentId`                    | Detalle público                     |
| GET    | `/api/v1/incidents/nearby`                         | Búsqueda cercana                    |
| GET    | `/api/v1/events/stream`                            | SSE                                 |
| GET    | `/api/v1/statistics/overview`                      | Resumen                             |
| GET    | `/api/v1/statistics/timeseries`                    | Series                              |
| GET    | `/api/v1/statistics/hourly`                        | Horas                               |
| GET    | `/api/v1/statistics/types`                         | Categorías                          |

Contratos clave:

- `cities`: `id`, `name`, `slug`, `countryCode`, `timezone`, `boundary` y,
  cuando existan, `center`, `bounds` y `boundarySource`;
- `config`: `h3BaseResolution`, `h3SupportedResolutions`, `heatmapScale` y sus
  equivalentes anidados;
- celda: `h3Index`, `resolution`, `period`, `month` nullable,
  `incidentCount`, `level`, `color`, `incidentTypes`, `lastUpdatedAt`;
- hexágono: centro, boundary, estadísticas e incidentes de los últimos 12
  meses;
- series: `scope`, `period`, `series` y campos de resumen opcionales;
- sesión: `user`, `accessToken`, expiración de access y refresh;
- SSE: objeto con `id`, `type`, `occurredAt` y `data`.

Requisitos backend inseparables del frontend:

- H3 4–9 e índices correspondientes;
- seed de Bogotá con límite real, centro y bounds;
- rechazo de reportes fuera de ciudad;
- agregados solo para `community_confirmed` y `admin_verified`;
- ventana móvil anual del mapa y detalle H3, con expiración por aniversario;
- `heatmap.updated.data.updates` granular;
- replay SSE por header o query;
- CORS y cookies según la sección 10;
- OpenAPI disponible en `/docs/json`.

## 30. Decisiones técnicas

1. **App Router y límites cliente:** las páginas y metadatos permanecen en
   Next.js; WebGL, Google, IndexedDB y SSE viven en componentes cliente.
2. **Mapa abierto para consulta:** OpenStreetMap aporta el contexto de calles;
   MapLibre/deck.gl renderiza el mapa y los hexágonos sin cargar Google en la
   landing. Google Maps queda aislado al reporte.
3. **H3 en worker:** la cuadrícula visible no bloquea React ni el hilo principal.
4. **Celdas vacías explícitas:** el cliente combina grid y agregados para
   representar cero en azul sin inventar incidentes.
5. **Backend como autoridad:** valida identidad, rol, límites, H3, estados y
   agregaciones.
6. **TanStack Query para servidor:** evita duplicar datos remotos en Zustand.
7. **Zustand mínimo:** conserva solo interacción del mapa, selección y estado
   efímero de interfaz.
8. **Persistencia pública selectiva:** IndexedDB acelera recargas sin almacenar
   credenciales.
9. **Access token efímero:** reduce exposición ante persistencia comprometida;
   la continuidad depende de cookie HttpOnly.
10. **SSE selectivo:** invalida mapa y detalle de la ciudad afectada, refresca
    estadísticas y usa notificaciones para eventos visibles o externos; el
    mapa anual añade una comprobación periódica para reflejar vencimientos.
11. **Escala compartida:** el backend publica colores y umbrales; el fallback
    solo permite degradación.
12. **Accesibilidad paralela:** mapas y gráficas tienen resumen o tabla; la
    información no depende solo de WebGL o color.
13. **Privacidad por defecto:** no hay multimedia, previews remotos ni
    persistencia de formularios/tokens.
14. **Dependencias conservadoras:** versiones exactas, siete días, lockfile y
    scripts de instalación en cuarentena.
15. **Sin datos simulados en producción:** los errores se muestran o se usa
    caché pública identificada; no se fabrican estadísticas.

Limitaciones deliberadas:

- el límite Natural Earth es adecuado para visualización nacional, no para
  decisiones catastrales;
- el replay SSE en memoria no garantiza entrega duradera;
- Google Maps es opcional y requiere una clave restringida y validación manual
  por dominio;
- la plataforma describe registros validados disponibles, no el riesgo absoluto
  de una zona.
