import { randomUUID } from "node:crypto";
import { gridDisk } from "h3-js";
import { MongoClient, ObjectId } from "mongodb";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  buildDemoNeighborIncidentDocuments,
  DEMO_BASE_RELOCATION_SEQUENCES,
  DEMO_NEIGHBOR_INCIDENTS_BATCH_ID,
  seedDemoNeighborIncidents2026,
  selectDemoCoverageCells,
  verifyDemoMonthlyStatistics,
} from "../../scripts/seed-demo-neighbor-incidents-2026.js";
import {
  buildDemoIncidentDocuments,
  DEMO_INCIDENTS_BATCH_ID,
} from "../../scripts/seed-demo-incidents-2026.js";
import { initializeDatabase } from "../../src/shared/database/initialize.js";
import { createTestConfig } from "../helpers/test-config.js";

const databaseName = `csya_coverage_test_${randomUUID().replaceAll("-", "")}`;
const config = createTestConfig(databaseName);
const client = new MongoClient(config.mongodbUri, {
  appName: "ciudadaniasegurayabe-coverage-seed-integration-test",
  serverSelectionTimeoutMS: 10_000,
});
const now = new Date("2026-08-18T20:00:00.000Z");
const adminId = new ObjectId("66a00000000000000000a001");
let city;
let baseDocuments;
let ownsTemporaryDatabase = false;

describe("persistencia del seed de cobertura territorial", () => {
  beforeAll(async () => {
    await client.connect();
    const existingCollections = await client
      .db(databaseName)
      .listCollections({}, { nameOnly: true })
      .toArray();
    if (existingCollections.length > 0) {
      throw new Error("La base temporal aleatoria ya contiene colecciones");
    }
    ownsTemporaryDatabase = true;
    await initializeDatabase({ config, client, now });

    const db = client.db(databaseName);
    city = await db.collection("cities").findOne({
      slug: "bogota",
      countryCode: "CO",
      active: true,
    });
    await db.collection("users").insertOne({
      _id: adminId,
      email: "coverage-seed@example.test",
      normalizedEmail: "coverage-seed@example.test",
      username: "coverage_seed",
      normalizedUsername: "coverage_seed",
      displayName: "Administrador de cobertura",
      passwordHash: "$argon2id$integration-test",
      role: "admin",
      status: "active",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      lastLoginAt: null,
    });
    baseDocuments = buildDemoIncidentDocuments({
      city,
      adminId,
      config,
      now,
    }).map((document) => ({
      ...document,
      createdByRole: "admin",
    }));
    await db.collection("incidents").insertMany(baseDocuments);
  }, 60_000);

  afterAll(async () => {
    try {
      if (ownsTemporaryDatabase) {
        await client.db(databaseName).dropDatabase();
      }
    } finally {
      await client.close();
    }
  }, 60_000);

  it("carga, recupera un estado parcial y se reejecuta sin duplicar", async () => {
    const db = client.db(databaseName);
    const incidents = db.collection("incidents");
    const beforeDryRun = await incidents
      .find(
        {},
        {
          projection: {
            h3Index: 1,
            h3Cells: 1,
            statisticsApplied: 1,
            seedMetadata: 1,
          },
          sort: { _id: 1 },
        },
      )
      .toArray();
    const preview = await seedDemoNeighborIncidents2026({
      config,
      client,
      now,
      dryRun: true,
    });
    expect(preview).toMatchObject({
      dryRun: true,
      upserted: 0,
      matched: 0,
      baseRelocated: 0,
      baseRelocationsPending: 5,
      syntheticTotal: 1_250,
    });
    expect(
      await incidents
        .find(
          {},
          {
            projection: {
              h3Index: 1,
              h3Cells: 1,
              statisticsApplied: 1,
              seedMetadata: 1,
            },
            sort: { _id: 1 },
          },
        )
        .toArray(),
    ).toEqual(beforeDryRun);
    expect(
      await db.collection("hex_monthly_stats").countDocuments(),
    ).toBe(0);

    const first = await seedDemoNeighborIncidents2026({
      config,
      client,
      now,
    });

    expect(first).toMatchObject({
      dryRun: false,
      upserted: 1_000,
      matched: 0,
      baseRelocated: 5,
      syntheticTotal: 1_250,
      statisticsVerification: {
        resolutions: [4, 5, 6, 7, 8, 9],
      },
      summary: {
        referenceCount: 30,
        neighborCounts: [18, 18, 18, 17, 17, 17],
        coverageCells: 900,
        populatedCells: 922,
      },
    });

    const coverageCells = selectDemoCoverageCells({
      city,
      baseResolution: config.h3BaseResolution,
    });
    const expectedAdditional = buildDemoNeighborIncidentDocuments({
      city,
      adminId,
      adminRole: "admin",
      config,
      now,
      coverageCells,
    });
    const retainedIds = expectedAdditional
      .slice(0, 137)
      .map(({ _id }) => _id);
    await incidents.deleteMany({
      "seedMetadata.batchId": DEMO_NEIGHBOR_INCIDENTS_BATCH_ID,
      _id: { $nin: retainedIds },
    });

    const revertedSequences = new Set(
      DEMO_BASE_RELOCATION_SEQUENCES.slice(2),
    );
    const revertOperations = baseDocuments
      .filter(({ seedMetadata }) =>
        revertedSequences.has(seedMetadata.sequence),
      )
      .map((document) => ({
        replaceOne: {
          filter: {
            _id: document._id,
            "seedMetadata.batchId": DEMO_INCIDENTS_BATCH_ID,
          },
          replacement: document,
        },
      }));
    await incidents.bulkWrite(revertOperations, { ordered: true });

    const recovered = await seedDemoNeighborIncidents2026({
      config,
      client,
      now,
    });
    expect(recovered).toMatchObject({
      upserted: 863,
      matched: 137,
      baseRelocated: 3,
      baseRelocationsPending: 0,
      syntheticTotal: 1_250,
      summary: {
        referenceCount: 30,
        neighborCounts: [18, 18, 18, 17, 17, 17],
        coverageCells: 900,
        populatedCells: 922,
      },
    });

    const repeated = await seedDemoNeighborIncidents2026({
      config,
      client,
      now,
    });
    expect(repeated).toMatchObject({
      upserted: 0,
      matched: 1_000,
      baseRelocated: 0,
      baseRelocationsPending: 0,
      syntheticTotal: 1_250,
      summary: recovered.summary,
      statisticsVerification: recovered.statisticsVerification,
    });

    expect(
      await incidents.countDocuments({
        "seedMetadata.batchId": {
          $in: [
            DEMO_INCIDENTS_BATCH_ID,
            DEMO_NEIGHBOR_INCIDENTS_BATCH_ID,
          ],
        },
      }),
    ).toBe(1_250);

    const counts = await incidents
      .aggregate([
        {
          $match: {
            "seedMetadata.batchId": {
              $in: [
                DEMO_INCIDENTS_BATCH_ID,
                DEMO_NEIGHBOR_INCIDENTS_BATCH_ID,
              ],
            },
          },
        },
        {
          $group: {
            _id: "$h3Cells.9",
            incidentCount: { $sum: 1 },
          },
        },
      ])
      .toArray();
    const countsByH3 = new Map(
      counts.map(({ _id, incidentCount }) => [_id, incidentCount]),
    );
    expect(countsByH3.get("8966e42f2abffff")).toBe(30);
    const neighbors = gridDisk("8966e42f2abffff", 1)
      .filter((index) => index !== "8966e42f2abffff")
      .sort((left, right) => left.localeCompare(right));
    expect(neighbors.map((index) => countsByH3.get(index))).toEqual([
      18, 18, 18, 17, 17, 17,
    ]);

    const [statisticsTotal] = await db
      .collection("hex_monthly_stats")
      .aggregate([
        { $match: { cityId: city._id, h3Resolution: 9 } },
        {
          $group: {
            _id: null,
            incidentCount: { $sum: "$incidentCount" },
          },
        },
      ])
      .toArray();
    expect(statisticsTotal.incidentCount).toBe(1_250);

    const statistics = db.collection("hex_monthly_stats");
    const statistic = await statistics.findOne({
      cityId: city._id,
      h3Resolution: 9,
    });
    await statistics.updateOne(
      { _id: statistic._id },
      {
        $set: {
          center: { type: "Point", coordinates: [0, 0] },
        },
      },
    );
    await expect(
      verifyDemoMonthlyStatistics({
        db,
        city,
        config,
        expectedUpdatedAt: now,
      }),
    ).rejects.toThrow("no coincide con los incidentes visibles");
  }, 120_000);
});
