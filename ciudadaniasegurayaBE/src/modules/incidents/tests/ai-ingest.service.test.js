import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";

import { createIncidentsService } from "../services/incidents.service.js";

describe("ingesta de incidentes con IA", () => {
  it("guarda un pendiente etiquetado sin confirmacion comunitaria", async () => {
    const cityId = new ObjectId();
    const incidentId = new ObjectId();
    const now = new Date("2026-08-29T12:00:00.000Z");
    const createReport = vi.fn();
    const createConfirmation = vi.fn();
    const incidentsRepository = {
      findBySourceUrl: vi.fn().mockResolvedValue(null),
      createIncident: vi.fn(async (document) => ({
        _id: incidentId,
        ...document,
      })),
      createReport,
      createConfirmation,
    };
    const eventBus = { publish: vi.fn() };
    const service = createIncidentsService({
      incidentsRepository,
      citiesRepository: {
        findActiveById: vi.fn().mockResolvedValue({
          _id: cityId,
          boundary: {
            type: "Polygon",
            coordinates: [
              [
                [-75, 4],
                [-73, 4],
                [-73, 5],
                [-75, 5],
                [-75, 4],
              ],
            ],
          },
        }),
      },
      appSettingsRepository: {},
      heatmapStatisticsService: {},
      auditRepository: {},
      eventBus,
      cache: { get: vi.fn(), set: vi.fn() },
      config: {
        h3SupportedResolutions: [9],
        h3BaseResolution: 9,
      },
      clock: () => now,
    });
    const input = {
      cityId: cityId.toHexString(),
      incidentType: "hurto",
      title: "Hurto reportado por fuente local",
      description: "Una fuente local reporto el hurto en este sector.",
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

    const result = await service.createAiIncident(input);

    expect(incidentsRepository.createIncident).toHaveBeenCalledWith(
      expect.objectContaining({
        cityId,
        status: "pending",
        submissionSource: "ai_scraper",
        locationConfirmed: true,
        evidenceDescription: input.evidenceDescription,
        createdBy: null,
        createdByRole: null,
        sourceUrls: [input.sourceUrl],
      }),
    );
    expect(createReport).not.toHaveBeenCalled();
    expect(createConfirmation).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      id: incidentId.toHexString(),
      status: "pending",
      submissionSource: "ai_scraper",
      locationConfirmed: true,
      evidenceDescription: input.evidenceDescription,
      reporter: { source: "ai_scraper" },
    });
    expect(eventBus.publish).toHaveBeenCalledWith(
      "admin.incident.pending.created",
      expect.objectContaining({ submissionSource: "ai_scraper" }),
    );
  });

  it("devuelve el incidente existente cuando la URL fuente ya fue ingerida", async () => {
    const cityId = new ObjectId();
    const incidentId = new ObjectId();
    const now = new Date("2026-08-29T12:00:00.000Z");
    const existing = {
      _id: incidentId,
      cityId,
      incidentType: "hurto",
      title: "Hurto reportado por fuente local",
      description: "Una fuente local reporto el hurto en este sector.",
      occurredAt: new Date("2026-08-28T23:30:00.000Z"),
      reportedAt: now,
      location: { type: "Point", coordinates: [-74.101, 4.651] },
      locationPrecision: "approximate",
      address: "Carrera 10 con calle 20",
      neighborhood: null,
      h3Index: "8928308280fffff",
      h3Resolution: 9,
      h3Cells: { 9: "8928308280fffff" },
      sourceUrls: ["https://example.com/noticia"],
      evidenceDescription: "Nota periodistica y registro fotografico.",
      locationConfirmed: true,
      submissionSource: "ai_scraper",
      status: "pending",
      confirmationCount: 0,
      verification: {
        method: "none",
        confirmationCount: 0,
        verifiedAt: null,
        verifiedBy: null,
      },
      createdBy: null,
      createdByRole: null,
      statisticsApplied: false,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };
    const incidentsRepository = {
      findBySourceUrl: vi.fn().mockResolvedValue(existing),
      createIncident: vi.fn(),
    };
    const eventBus = { publish: vi.fn() };
    const service = createIncidentsService({
      incidentsRepository,
      citiesRepository: {
        findActiveById: vi.fn().mockResolvedValue({
          _id: cityId,
          boundary: {
            type: "Polygon",
            coordinates: [
              [
                [-75, 4],
                [-73, 4],
                [-73, 5],
                [-75, 5],
                [-75, 4],
              ],
            ],
          },
        }),
      },
      appSettingsRepository: {},
      heatmapStatisticsService: {},
      auditRepository: {},
      eventBus,
      cache: { get: vi.fn(), set: vi.fn() },
      config: { h3SupportedResolutions: [9], h3BaseResolution: 9 },
      clock: () => now,
    });

    const result = await service.createAiIncident({
      cityId: cityId.toHexString(),
      incidentType: "hurto",
      title: existing.title,
      description: existing.description,
      occurredAt: "2026-08-28T18:30:00-05:00",
      latitude: 4.651,
      longitude: -74.101,
      locationPrecision: "approximate",
      address: existing.address,
      sourceUrl: existing.sourceUrls[0],
      evidenceDescription: existing.evidenceDescription,
      confirmLocation: true,
    });

    expect(result.id).toBe(incidentId.toHexString());
    expect(incidentsRepository.createIncident).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });
});
