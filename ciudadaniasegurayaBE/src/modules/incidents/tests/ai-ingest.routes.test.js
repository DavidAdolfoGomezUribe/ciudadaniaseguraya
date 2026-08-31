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

const cityId = new ObjectId().toHexString();
const incidentId = new ObjectId().toHexString();
const validBody = {
  cityId,
  incidentType: "hurto",
  title: "Hurto reportado por fuente local",
  description: "Una fuente local reporto el hurto en el sector indicado.",
  occurredAt: "2026-08-28T18:30:00-05:00",
  latitude: 4.651,
  longitude: -74.101,
  locationPrecision: "approximate",
  address: "Carrera 10 con calle 20",
  neighborhood: "Centro",
  sourceUrl: "https://example.com/noticia",
  evidenceDescription: "Nota periodistica y registro fotografico.",
  confirmLocation: true,
};

let app;
let service;

describe("POST de ingesta de incidentes con IA", () => {
  beforeEach(async () => {
    app = Fastify({ logger: false });
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    setErrorHandlers(app);
    service = {
      createAiIncident: vi.fn().mockResolvedValue({
        id: incidentId,
        status: "pending",
        submissionSource: "ai_scraper",
      }),
    };
    const passthrough = async () => {};
    await registerIncidentRoutes(app, {
      controller: createIncidentsController(service),
      authenticate: passthrough,
      authenticateAiIngest: passthrough,
      requireAdmin: passthrough,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("crea directamente un incidente pendiente con origen IA", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/ai/incidents",
      payload: validBody,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data).toMatchObject({
      id: incidentId,
      status: "pending",
      submissionSource: "ai_scraper",
    });
    expect(service.createAiIncident).toHaveBeenCalledWith(validBody);
  });

  it("rechaza la solicitud si el checkbox no es true", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/integrations/ai/incidents",
      payload: { ...validBody, confirmLocation: false },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
    expect(service.createAiIncident).not.toHaveBeenCalled();
  });
});
