import { cellToParent, gridDisk } from "h3-js";
import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import {
  buildDemoNeighborIncidentDocuments,
  DEMO_BASE_RELOCATION_SEQUENCES,
  DEMO_COVERAGE_CELLS_TOTAL,
  DEMO_EXPECTED_POPULATED_CELLS,
  DEMO_NEIGHBOR_INCIDENTS_BATCH_ID,
  DEMO_NEIGHBOR_INCIDENTS_TOTAL,
  DEMO_NEW_COVERAGE_INCIDENTS_TOTAL,
  DEMO_REFERENCE_FINAL_COUNT,
  DEMO_REFERENCE_H3_INDEX,
  DEMO_REFERENCE_NEIGHBOR_COUNTS,
  seedDemoNeighborIncidents2026,
  selectDemoCoverageCells,
  summarizeDemoCoverageLayout,
  validateDemoBaseBatchDocuments,
} from "../../../../scripts/seed-demo-neighbor-incidents-2026.js";
import {
  buildDemoIncidentDocuments,
  DEMO_HOTSPOTS,
  DEMO_INCIDENTS_REPORTING_DELAY_MS,
  DEMO_INCIDENTS_TOTAL,
  DEMO_INCIDENTS_YEAR_START,
} from "../../../../scripts/seed-demo-incidents-2026.js";
import {
  BOGOTA_BOUNDARY,
  BOGOTA_CENTER,
} from "../../geolocation/constants/bogota-geography.js";
import {
  h3Cell,
  h3CellsForResolutions,
  h3Center,
} from "../../geolocation/h3/h3.js";
import { pointBelongsToBoundary } from "../../geolocation/providers/city-boundary.js";

const cityId = new ObjectId("66a000000000000000000001");
const adminId = new ObjectId("66a000000000000000000002");
const adminRole = "admin";
const city = {
  _id: cityId,
  name: "Bogota",
  slug: "bogota",
  countryCode: "CO",
  timezone: "America/Bogota",
  active: true,
  boundary: BOGOTA_BOUNDARY,
  center: BOGOTA_CENTER,
};
const config = {
  h3BaseResolution: 9,
  h3SupportedResolutions: [4, 5, 6, 7, 8, 9],
};
const now = new Date("2026-08-18T20:00:00.000Z");

function coverageCells() {
  return selectDemoCoverageCells({ city, baseResolution: 9 });
}

function buildBase() {
  return buildDemoIncidentDocuments({ city, adminId, config, now });
}

function build(coverage = coverageCells()) {
  return buildDemoNeighborIncidentDocuments({
    city,
    adminId,
    adminRole,
    config,
    now,
    coverageCells: coverage,
  });
}

function countsByCell(incidents) {
  const counts = new Map();

  for (const incident of incidents) {
    counts.set(
      incident.h3Index,
      (counts.get(incident.h3Index) ?? 0) + 1,
    );
  }

  return counts;
}

function relocatedBase(base, coverage, amount) {
  const targets = new Map(
    DEMO_BASE_RELOCATION_SEQUENCES.slice(0, amount).map(
      (sequence, index) => [sequence, coverage[index]],
    ),
  );

  return base.map((document) => {
    const targetH3Index = targets.get(document.seedMetadata.sequence);
    if (!targetH3Index) {
      return document;
    }

    const center = h3Center(targetH3Index);
    const h3Cells = h3CellsForResolutions(
      center.latitude,
      center.longitude,
      config.h3SupportedResolutions,
    );
    return {
      ...document,
      location: center.point,
      h3Index: targetH3Index,
      h3Cells,
      seedMetadata: {
        ...document.seedMetadata,
        redistribution: {
          batchId: DEMO_NEIGHBOR_INCIDENTS_BATCH_ID,
          layoutVersion: 2,
          purpose: "bogota-city-coverage",
          originalH3Index: DEMO_REFERENCE_H3_INDEX,
          assignedH3Index: targetH3Index,
        },
      },
    };
  });
}

describe("seed sintetico de cobertura territorial 2026", () => {
  it("selecciona 900 celdas deterministas y cubre todos los padres H3 de Bogota", () => {
    const first = coverageCells();
    const second = coverageCells();
    const anchors = DEMO_HOTSPOTS.map((hotspot) =>
      h3Cell(hotspot.latitude, hotspot.longitude, 9),
    );
    const referenceDisk = new Set(gridDisk(DEMO_REFERENCE_H3_INDEX, 1));

    expect(second).toEqual(first);
    expect(first).toHaveLength(DEMO_COVERAGE_CELLS_TOTAL);
    expect(new Set(first)).toHaveLength(DEMO_COVERAGE_CELLS_TOTAL);
    expect(first.some((index) => anchors.includes(index))).toBe(false);
    expect(first.some((index) => referenceDisk.has(index))).toBe(false);
    expect(new Set(first.map((index) => cellToParent(index, 8)))).toHaveLength(
      578,
    );
    expect(new Set(first.map((index) => cellToParent(index, 7)))).toHaveLength(
      104,
    );
    expect(new Set(first.map((index) => cellToParent(index, 6)))).toHaveLength(
      22,
    );

    for (const index of first) {
      expect(
        pointBelongsToBoundary(h3Center(index).point, BOGOTA_BOUNDARY),
      ).toBe(true);
    }
  });

  it("mantiene un incidente en cada vecino de los otros hotspots", () => {
    const coverage = new Set(coverageCells());

    for (const hotspot of DEMO_HOTSPOTS) {
      const anchor = h3Cell(hotspot.latitude, hotspot.longitude, 9);
      if (anchor === DEMO_REFERENCE_H3_INDEX) {
        continue;
      }
      const neighbors = gridDisk(anchor, 1).filter(
        (index) => index !== anchor,
      );
      expect(neighbors.every((index) => coverage.has(index))).toBe(true);
    }
  });

  it("genera exactamente 1000 incidentes adicionales con 895 de cobertura", () => {
    const incidents = build();
    const distributionCounts = incidents.reduce((counts, incident) => {
      const key = incident.seedMetadata.distribution;
      counts[key] = (counts[key] ?? 0) + 1;
      expect(incident).toMatchObject({
        cityId,
        status: "admin_verified",
        h3Resolution: 9,
        createdBy: adminId,
        createdByRole: adminRole,
        statisticsApplied: false,
        deletedAt: null,
        mergedInto: null,
        verification: {
          method: "admin",
          confirmationCount: 0,
          verifiedBy: adminId,
        },
        seedMetadata: {
          batchId: DEMO_NEIGHBOR_INCIDENTS_BATCH_ID,
          synthetic: true,
          purpose: "annual-heatmap-city-coverage",
          layoutVersion: 2,
        },
      });
      return counts;
    }, {});

    expect(DEMO_NEIGHBOR_INCIDENTS_TOTAL).toBe(1_000);
    expect(incidents).toHaveLength(1_000);
    expect(distributionCounts).toEqual({
      "reference-neighbor": 105,
      "bogota-coverage": DEMO_NEW_COVERAGE_INCIDENTS_TOTAL,
    });
    expect(countsByCell(incidents)).toHaveLength(901);
  });

  it("deja 30 en el centro, 17/18 en vecinos y 922 celdas pobladas", () => {
    const coverage = coverageCells();
    const incidents = build(coverage);
    const base = buildBase();
    const summary = summarizeDemoCoverageLayout({
      baseDocuments: base,
      neighborDocuments: incidents,
      coverageCells: coverage,
    });
    const newCounts = countsByCell(incidents);

    expect(summary).toEqual({
      total: DEMO_INCIDENTS_TOTAL + DEMO_NEIGHBOR_INCIDENTS_TOTAL,
      referenceCount: DEMO_REFERENCE_FINAL_COUNT,
      neighborCounts: [...DEMO_REFERENCE_NEIGHBOR_COUNTS],
      coverageCells: DEMO_COVERAGE_CELLS_TOTAL,
      populatedCells: DEMO_EXPECTED_POPULATED_CELLS,
      coverageParentsResolution8: 578,
      coverageParentsResolution7: 104,
      coverageParentsResolution6: 22,
    });
    expect(newCounts.get(DEMO_REFERENCE_H3_INDEX) ?? 0).toBe(0);
    expect(newCounts.get("8966e42f2bbffff")).toBe(17);
  });

  it("acepta una reconciliacion base pendiente, parcial o completa", () => {
    const coverage = coverageCells();
    const base = buildBase();
    const pending = validateDemoBaseBatchDocuments(base, {
      city,
      coverageCells: coverage,
    });
    const partial = validateDemoBaseBatchDocuments(
      relocatedBase(base, coverage, 2),
      { city, coverageCells: coverage },
    );
    const complete = validateDemoBaseBatchDocuments(
      relocatedBase(base, coverage, 5),
      { city, coverageCells: coverage },
    );

    expect(pending.relocatedCount).toBe(0);
    expect(partial.relocatedCount).toBe(2);
    expect(complete.relocatedCount).toBe(5);
    expect(pending.adminId).toEqual(adminId);
    expect(() =>
      validateDemoBaseBatchDocuments(base.slice(1), {
        city,
        coverageCells: coverage,
      }),
    ).toThrow("249 registros");
    expect(() =>
      validateDemoBaseBatchDocuments(
        [{ ...base[0], status: "archived" }, ...base.slice(1)],
        { city, coverageCells: coverage },
      ),
    ).toThrow("invalido o no visible");

    const unrelatedRedistribution = base.map((document) =>
      document.seedMetadata.sequence === 1
        ? {
            ...document,
            seedMetadata: {
              ...document.seedMetadata,
              redistribution: { batchId: "otro-lote" },
            },
          }
        : document,
    );
    expect(() =>
      validateDemoBaseBatchDocuments(unrelatedRedistribution, {
        city,
        coverageCells: coverage,
      }),
    ).toThrow("no conserva la celda central");

    const selectedWithUnrelatedMetadata = base.map((document) =>
      document.seedMetadata.sequence ===
      DEMO_BASE_RELOCATION_SEQUENCES[0]
        ? {
            ...document,
            seedMetadata: {
              ...document.seedMetadata,
              redistribution: { batchId: "otro-lote" },
            },
          }
        : document,
    );
    expect(() =>
      validateDemoBaseBatchDocuments(selectedWithUnrelatedMetadata, {
        city,
        coverageCells: coverage,
      }),
    ).toThrow("metadatos de redistribucion inconsistentes");
  });

  it("usa IDs deterministas distintos al lote anterior y fechas hasta ahora", () => {
    const coverage = coverageCells();
    const first = build(coverage);
    const second = build(coverage);
    const existingIds = new Set(
      buildBase().map(({ _id }) => _id.toHexString()),
    );

    expect(second.map(({ _id }) => _id.toHexString())).toEqual(
      first.map(({ _id }) => _id.toHexString()),
    );
    expect(
      first.every(({ _id }) => !existingIds.has(_id.toHexString())),
    ).toBe(true);
    expect(first[0].occurredAt.toISOString()).toBe(
      DEMO_INCIDENTS_YEAR_START,
    );
    expect(first.at(-1).occurredAt.getTime()).toBe(
      now.getTime() - DEMO_INCIDENTS_REPORTING_DELAY_MS,
    );

    for (let index = 0; index < first.length; index += 1) {
      const incident = first[index];
      expect(incident.reportedAt.getTime()).toBe(
        incident.occurredAt.getTime() +
          DEMO_INCIDENTS_REPORTING_DELAY_MS,
      );
      if (index > 0) {
        expect(incident.occurredAt.getTime()).toBeGreaterThan(
          first[index - 1].occurredAt.getTime(),
        );
      }
    }
  });

  it("mantiene cada punto dentro de Bogota y en la celda H3 asignada", () => {
    const incidents = build();

    for (const incident of incidents) {
      const [longitude, latitude] = incident.location.coordinates;

      expect(
        pointBelongsToBoundary(incident.location, BOGOTA_BOUNDARY),
      ).toBe(true);
      expect(incident.h3Index).toBe(h3Cell(latitude, longitude, 9));
      expect(incident.h3Index).toBe(
        incident.seedMetadata.assignedH3Index,
      );
      expect(incident.h3Cells).toEqual({
        4: h3Cell(latitude, longitude, 4),
        5: h3Cell(latitude, longitude, 5),
        6: h3Cell(latitude, longitude, 6),
        7: h3Cell(latitude, longitude, 7),
        8: h3Cell(latitude, longitude, 8),
        9: h3Cell(latitude, longitude, 9),
      });
    }
  });

  it("bloquea escrituras en produccion sin autorizacion explicita", async () => {
    await expect(
      seedDemoNeighborIncidents2026({
        config: { nodeEnv: "production" },
      }),
    ).rejects.toThrow("ALLOW_SYNTHETIC_PRODUCTION_SEED=true");
  });
});
