import Fastify from "fastify";
import { ObjectId } from "mongodb";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setErrorHandlers } from "../../../shared/errors/error-handler.js";
import { createIncidentsController } from "../controllers/incidents.controller.js";
import { registerIncidentRoutes } from "../routes/incident.routes.js";

const incidentId = new ObjectId().toHexString();
const actorId = new ObjectId();
const expectedUpdatedAt = "2026-07-29T12:00:00.000Z";
let app;
let service;

describe("rutas administrativas de incidentes", () => {
  beforeEach(async () => {
    app = Fastify({ logger: false });
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    setErrorHandlers(app);
    service = {
      listAdmin: vi.fn().mockResolvedValue({ incidents: [], total: 0 }),
      getAdmin: vi.fn().mockResolvedValue({ id: incidentId }),
      reject: vi.fn().mockResolvedValue({ id: incidentId, status: "rejected" }),
      claimReviewLock: vi
        .fn()
        .mockResolvedValue({ id: incidentId, reviewLock: {} }),
    };
    const requireAdmin = async (request) => {
      request.authUser = {
        id: actorId,
        role: "admin",
        username: "moderador",
      };
    };
    await registerIncidentRoutes(app, {
      controller: createIncidentsController(service),
      authenticate: requireAdmin,
      requireAdmin,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("lista pendientes del mas antiguo al mas reciente por defecto", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/incidents",
    });

    expect(response.statusCode).toBe(200);
    expect(service.listAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        pageSize: 25,
        status: "pending",
        sortBy: "createdAt",
        sortOrder: "asc",
      }),
    );
  });

  it("exige motivo, codigo y version para rechazar", async () => {
    const invalid = await app.inject({
      method: "POST",
      url: `/api/v1/admin/incidents/${incidentId}/reject`,
      payload: {},
    });
    const valid = await app.inject({
      method: "POST",
      url: `/api/v1/admin/incidents/${incidentId}/reject`,
      payload: {
        reasonCode: "insufficient_evidence",
        reason: "La evidencia disponible no permite validar el incidente.",
        expectedUpdatedAt,
      },
    });

    expect(invalid.statusCode).toBe(400);
    expect(valid.statusCode).toBe(200);
    expect(service.reject).toHaveBeenCalledWith(
      incidentId,
      expect.objectContaining({
        reasonCode: "insufficient_evidence",
        expectedUpdatedAt,
      }),
      expect.objectContaining({ id: actorId }),
      expect.any(String),
    );
  });

  it("expone el reclamo temporal con vencimiento acotado", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/api/v1/admin/incidents/${incidentId}/review-lock`,
      payload: { expectedUpdatedAt, ttlSeconds: 600 },
    });

    expect(response.statusCode).toBe(200);
    expect(service.claimReviewLock).toHaveBeenCalledWith(
      incidentId,
      { expectedUpdatedAt, ttlSeconds: 600 },
      expect.objectContaining({ id: actorId }),
      expect.any(String),
    );
  });
});
