import { z } from "zod";

import { createAdminAuthController } from "../modules/admin/auth/controllers/admin-auth.controller.js";
import { createAdminSessionRepository } from "../modules/admin/auth/repositories/admin-session.repository.js";
import { registerAdminAuthRoutes } from "../modules/admin/auth/routes/admin-auth.routes.js";
import { createAdminAuthService } from "../modules/admin/auth/services/admin-auth.service.js";
import { createAgentControlController } from "../modules/admin/agent-control/controllers/agent-control.controller.js";
import { registerAgentControlRoutes } from "../modules/admin/agent-control/routes/agent-control.routes.js";
import { createAgentControlService } from "../modules/admin/agent-control/services/agent-control.service.js";
import { createAdminManagementController } from "../modules/admin/management/controllers/admin-management.controller.js";
import { createAdminManagementRepository } from "../modules/admin/management/repositories/admin-management.repository.js";
import { registerAdminManagementRoutes } from "../modules/admin/management/routes/admin-management.routes.js";
import { createAdminManagementService } from "../modules/admin/management/services/admin-management.service.js";
import { ADMIN_ROLES } from "../modules/admin/permissions.js";
import { createAuthController } from "../modules/auth/controllers/auth.controller.js";
import { createGoogleIdentityProvider } from "../modules/auth/providers/google-identity.provider.js";
import { createRefreshTokenRepository } from "../modules/auth/repositories/refresh-token.repository.js";
import { registerAuthRoutes } from "../modules/auth/routes/auth.routes.js";
import { createAuthService } from "../modules/auth/services/auth.service.js";
import { createCommentsController } from "../modules/forum/comments/controllers/comments.controller.js";
import { createCommentsRepository } from "../modules/forum/comments/repositories/comments.repository.js";
import { registerCommentRoutes } from "../modules/forum/comments/routes/comment.routes.js";
import { createCommentsService } from "../modules/forum/comments/services/comments.service.js";
import { createPostsController } from "../modules/forum/posts/controllers/posts.controller.js";
import { createPostsRepository } from "../modules/forum/posts/repositories/posts.repository.js";
import { registerPostRoutes } from "../modules/forum/posts/routes/post.routes.js";
import { createPostsService } from "../modules/forum/posts/services/posts.service.js";
import { createReactionsController } from "../modules/forum/reactions/controllers/reactions.controller.js";
import { createReactionsRepository } from "../modules/forum/reactions/repositories/reactions.repository.js";
import { registerReactionRoutes } from "../modules/forum/reactions/routes/reaction.routes.js";
import { createReactionsService } from "../modules/forum/reactions/services/reactions.service.js";
import { createAccountContentRepository } from "../modules/forum/repositories/account-content.repository.js";
import { createGeolocationController } from "../modules/geolocation/controllers/geolocation.controller.js";
import { createCitiesRepository } from "../modules/geolocation/repositories/cities.repository.js";
import { createHeatmapRepository } from "../modules/geolocation/repositories/heatmap.repository.js";
import { registerGeolocationRoutes } from "../modules/geolocation/routes/geolocation.routes.js";
import { createGeolocationService } from "../modules/geolocation/services/geolocation.service.js";
import { createHeatmapStatisticsService } from "../modules/geolocation/services/heatmap-statistics.service.js";
import { createIncidentsController } from "../modules/incidents/controllers/incidents.controller.js";
import { createIncidentsRepository } from "../modules/incidents/repositories/incidents.repository.js";
import { registerIncidentRoutes } from "../modules/incidents/routes/incident.routes.js";
import { createIncidentsService } from "../modules/incidents/services/incidents.service.js";
import { createStatisticsController } from "../modules/statistics/controllers/statistics.controller.js";
import { createStatisticsRepository } from "../modules/statistics/repositories/statistics.repository.js";
import { registerStatisticsRoutes } from "../modules/statistics/routes/statistics.routes.js";
import { createStatisticsService } from "../modules/statistics/services/statistics.service.js";
import { createUsersController } from "../modules/users/controllers/users.controller.js";
import { createUsersRepository } from "../modules/users/repositories/users.repository.js";
import { registerUserRoutes } from "../modules/users/routes/user.routes.js";
import { createUsersService } from "../modules/users/services/users.service.js";
import { createConnectionRegistry } from "../infrastructure/messaging/connection-registry.js";
import {
  isAdministrativeRealtimeEvent,
  isPublicRealtimeEvent,
} from "../infrastructure/messaging/event-scope.js";
import { createRealtimeController } from "../infrastructure/messaging/realtime.controller.js";
import { registerRealtimeRoutes } from "../infrastructure/messaging/realtime.routes.js";
import { createAuditRepository } from "../shared/audit/audit.repository.js";
import { createAppSettingsRepository } from "../shared/config/app-settings.repository.js";
import { collectionDefinitions } from "../shared/database/schema.js";
import { AppError } from "../shared/errors/app-error.js";
import { registerAuthGuards } from "../shared/middleware/auth.js";
import { createAiIngestGuard } from "../shared/middleware/ai-ingest-auth.js";
import { isAllowedOrigin } from "../shared/security/origins.js";
import { successResponseSchema } from "../shared/utils/api-schemas.js";
import { success } from "../shared/utils/response.js";

async function healthRoutes(app) {
  app.get(
    "/health",
    {
      config: {
        rateLimit: false,
      },
      schema: {
        tags: ["Health"],
        summary: "Comprueba que el proceso esta activo",
        response: {
          200: successResponseSchema,
        },
      },
    },
    async (request) =>
      success(request, {
        status: "ok",
        uptimeSeconds: Math.floor(process.uptime()),
      }),
  );

  app.get(
    "/ready",
    {
      config: {
        rateLimit: false,
      },
      schema: {
        tags: ["Health"],
        summary: "Comprueba las dependencias esenciales",
        response: {
          200: successResponseSchema,
          503: z.unknown().describe("El servicio aun no esta disponible"),
        },
      },
    },
    async (request) => {
      try {
        await app.db.command({ ping: 1, maxTimeMS: 2_000 });
        const collections = new Set(
          (
            await app.db
              .listCollections({}, { nameOnly: true })
              .toArray()
          ).map(({ name }) => name),
        );
        if (
          !collectionDefinitions.map(({ name }) => name).every((name) =>
            collections.has(name),
          )
        ) {
          throw new Error("database is not initialized");
        }
      } catch (_error) {
        throw new AppError({
          code: "SERVICE_UNAVAILABLE",
          message: "El servicio no esta disponible temporalmente",
          statusCode: 503,
        });
      }

      return success(request, {
        status: "ready",
        database: "available",
      });
    },
  );
}

export async function registerRoutes(
  app,
  {
    googleIdentityProvider = createGoogleIdentityProvider({
      clientId: app.config.googleClientId,
    }),
  } = {},
) {
  await app.register(healthRoutes);

  app.get(
    "/",
    {
      schema: {
        tags: ["Health"],
        summary: "Identifica el servicio",
        response: {
          200: successResponseSchema,
        },
      },
    },
    async (request) =>
      success(request, {
        service: "ciudadaniasegurayabe",
        version: "1.0.0",
        documentation: "/docs",
    }),
  );

  const usersRepository = createUsersRepository(app.db);
  const refreshTokenRepository = createRefreshTokenRepository(app.db);
  const adminSessionRepository = createAdminSessionRepository(app.db);
  const adminManagementRepository = createAdminManagementRepository(app.db);
  const auditRepository = createAuditRepository(app.db);
  const citiesRepository = createCitiesRepository(app.db);
  const incidentsRepository = createIncidentsRepository(app.db);
  const heatmapRepository = createHeatmapRepository(app.db);
  const statisticsRepository = createStatisticsRepository(app.db);
  const appSettingsRepository = createAppSettingsRepository(app.db);
  const postsRepository = createPostsRepository(app.db);
  const commentsRepository = createCommentsRepository(app.db);
  const reactionsRepository = createReactionsRepository(app.db);
  const accountContentRepository = createAccountContentRepository(app.db);
  const connectionRegistry = createConnectionRegistry();
  const adminConnectionRegistry = createConnectionRegistry();
  const guards = registerAuthGuards(
    app,
    usersRepository,
    adminSessionRepository,
  );
  const verifyTrustedOrigin = async (request) => {
    if (
      !isAllowedOrigin(
        request.headers.origin,
        app.config.corsOrigins,
        app.config.corsOriginPatterns,
      )
    ) {
      throw new AppError({
        code: "UNTRUSTED_ORIGIN",
        message: "El origen de la solicitud no esta permitido",
        statusCode: 403,
      });
    }
  };
  const authService = createAuthService({
    usersRepository,
    refreshTokenRepository,
    googleIdentityProvider,
    config: app.config,
    signAccessToken: (payload) => app.jwt.sign(payload),
  });
  const adminAuthService = createAdminAuthService({
    usersRepository,
    adminSessionRepository,
    auditRepository,
    config: app.config,
    signAccessToken: (payload) => app.jwt.sign(payload),
  });
  const adminManagementService = createAdminManagementService({
    repository: adminManagementRepository,
    auditRepository,
    eventBus: app.eventBus,
  });
  const agentControlService = createAgentControlService({
    config: app.config,
    auditRepository,
  });
  const usersService = createUsersService({
    usersRepository,
    refreshTokenRepository,
    auditRepository,
    accountContentRepository,
  });
  const heatmapStatisticsService = createHeatmapStatisticsService({
    incidentsRepository,
    heatmapRepository,
    citiesRepository,
    eventBus: app.eventBus,
    config: app.config,
  });
  const incidentsService = createIncidentsService({
    incidentsRepository,
    citiesRepository,
    appSettingsRepository,
    heatmapStatisticsService,
    auditRepository,
    eventBus: app.eventBus,
    cache: app.cache,
    config: app.config,
  });
  const geolocationService = createGeolocationService({
    citiesRepository,
    heatmapRepository,
    incidentsRepository,
    config: app.config,
  });
  const statisticsService = createStatisticsService({
    statisticsRepository,
    citiesRepository,
    config: app.config,
  });
  const postsService = createPostsService({
    postsRepository,
    incidentsRepository,
    auditRepository,
    eventBus: app.eventBus,
  });
  const commentsService = createCommentsService({
    commentsRepository,
    postsRepository,
    auditRepository,
    eventBus: app.eventBus,
  });
  const reactionsService = createReactionsService({
    reactionsRepository,
    postsRepository,
    commentsRepository,
  });

  await registerAuthRoutes(app, {
    controller: createAuthController({
      authService,
      config: app.config,
    }),
    authenticate: guards.authenticate,
    verifyTrustedOrigin,
  });
  await registerAdminAuthRoutes(app, {
    controller: createAdminAuthController({
      adminAuthService,
      config: app.config,
    }),
    authenticateAdmin: guards.authenticateAdmin,
    verifyTrustedOrigin,
    rateLimitMax: app.config.adminAuthRateLimitMax,
    rateLimitWindowMs: app.config.adminAuthRateLimitWindowMs,
  });
  await registerAdminManagementRoutes(app, {
    controller: createAdminManagementController(adminManagementService),
    authenticate: guards.authenticate,
    authenticateAdmin: guards.authenticateAdmin,
    requirePermission: guards.requirePermission,
  });
  await registerAgentControlRoutes(app, {
    controller: createAgentControlController(agentControlService),
    authenticateAdmin: guards.authenticateAdmin,
    requirePermission: guards.requirePermission,
  });
  await registerUserRoutes(app, {
    controller: createUsersController(usersService, app.config),
    authenticate: guards.authenticate,
    requireAdmin: guards.requireAdmin,
  });
  await registerIncidentRoutes(app, {
    controller: createIncidentsController(incidentsService),
    authenticate: guards.authenticate,
    authenticateAiIngest: createAiIngestGuard({
      apiKey: app.config.aiIngestApiKey,
    }),
    requireAdmin: guards.requireAdmin,
    requirePermission: guards.requirePermission,
  });
  await registerGeolocationRoutes(app, {
    controller: createGeolocationController(geolocationService),
    defaultResolution: app.config.h3BaseResolution,
  });
  await registerStatisticsRoutes(app, {
    controller: createStatisticsController(statisticsService),
  });
  await registerPostRoutes(app, {
    controller: createPostsController(postsService),
    authenticate: guards.authenticate,
    requireAdmin: guards.requireAdmin,
    requirePermission: guards.requirePermission,
  });
  await registerCommentRoutes(app, {
    controller: createCommentsController(commentsService),
    authenticate: guards.authenticate,
    requireAdmin: guards.requireAdmin,
    requirePermission: guards.requirePermission,
  });
  await registerReactionRoutes(app, {
    controller: createReactionsController(reactionsService),
    authenticate: guards.authenticate,
  });
  await registerRealtimeRoutes(app, {
    controller: createRealtimeController({
      eventBus: app.eventBus,
      connectionRegistry,
      acceptsEvent: isPublicRealtimeEvent,
    }),
    adminController: createRealtimeController({
      eventBus: app.eventBus,
      connectionRegistry: adminConnectionRegistry,
      acceptsEvent: isAdministrativeRealtimeEvent,
      connectedEventType: "admin.system.connected",
      connectionExpiresAt: (request) =>
        request.user?.exp ? request.user.exp * 1_000 : null,
      revalidateConnection: async (request) => {
        const admin = request.authAdmin;
        if (!admin) return false;
        const [user, session] = await Promise.all([
          usersRepository.findById(admin.id),
          adminSessionRepository.findActiveSession(
            admin.sessionId,
            admin.id,
            new Date(),
          ),
        ]);
        return Boolean(
          user &&
            user.status === "active" &&
            ADMIN_ROLES.includes(user.role) &&
            session,
        );
      },
    }),
    authenticateAdmin: guards.authenticateAdmin,
  });
}
