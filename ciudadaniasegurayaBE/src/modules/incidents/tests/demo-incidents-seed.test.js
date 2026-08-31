import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import {
  buildDemoIncidentDocuments,
  DEMO_HOTSPOTS,
  DEMO_INCIDENTS_BATCH_ID,
  DEMO_INCIDENTS_REPORTING_DELAY_MS,
  DEMO_INCIDENTS_TOTAL,
  DEMO_INCIDENTS_YEAR_START,
} from "../../../../scripts/seed-demo-incidents-2026.js";
import {
  BOGOTA_BOUNDARY,
  BOGOTA_CENTER,
} from "../../geolocation/constants/bogota-geography.js";
import { h3Cell } from "../../geolocation/h3/h3.js";
import { pointBelongsToBoundary } from "../../geolocation/providers/city-boundary.js";

const cityId = new ObjectId("66a000000000000000000001");
const adminId = new ObjectId("66a000000000000000000002");
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
const now = new Date("2026-07-27T20:00:00.000Z");

function build() {
  return buildDemoIncidentDocuments({
    city,
    adminId,
    config,
    now,
  });
}

describe("seed sintetico de incidentes 2026", () => {
  it("genera 250 incidentes visibles y el gradiente exacto de hotspots", () => {
    const incidents = build();
    const counts = new Map();

    for (const incident of incidents) {
      counts.set(
        incident.h3Index,
        (counts.get(incident.h3Index) ?? 0) + 1,
      );
      expect(incident).toMatchObject({
        cityId,
        status: "admin_verified",
        h3Resolution: 9,
        createdBy: adminId,
        createdByRole: "superadmin",
        statisticsApplied: false,
        deletedAt: null,
        mergedInto: null,
        verification: {
          method: "admin",
          confirmationCount: 0,
          verifiedBy: adminId,
        },
        seedMetadata: {
          batchId: DEMO_INCIDENTS_BATCH_ID,
          synthetic: true,
          purpose: "annual-heatmap-demo",
        },
      });
    }

    expect(DEMO_INCIDENTS_TOTAL).toBe(250);
    expect(incidents).toHaveLength(250);
    expect(counts).toHaveLength(16);
    expect([...counts.values()].sort((left, right) => right - left)).toEqual(
      DEMO_HOTSPOTS.map(({ incidentCount }) => incidentCount),
    );
  });

  it("usa IDs deterministas y fechas ordenadas entre enero y ahora", () => {
    const first = build();
    const second = build();

    expect(
      second.map(({ _id }) => _id.toHexString()),
    ).toEqual(first.map(({ _id }) => _id.toHexString()));
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
      expect(incident.reportedAt.getTime()).toBeLessThanOrEqual(
        now.getTime(),
      );
      if (index > 0) {
        expect(incident.occurredAt.getTime()).toBeGreaterThan(
          first[index - 1].occurredAt.getTime(),
        );
      }
    }
  });

  it("mantiene cada punto dentro de Bogota y en su celda H3 declarada", () => {
    const incidents = build();

    for (const incident of incidents) {
      const [longitude, latitude] = incident.location.coordinates;

      expect(
        pointBelongsToBoundary(incident.location, BOGOTA_BOUNDARY),
      ).toBe(true);
      expect(incident.h3Index).toBe(h3Cell(latitude, longitude, 9));
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
});
