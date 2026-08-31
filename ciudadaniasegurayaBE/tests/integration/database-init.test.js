import { MongoClient } from "mongodb";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import { seedSuperadmin } from "../../scripts/seed-superadmin.js";
import { initializeDatabase } from "../../src/shared/database/initialize.js";
import { createTestConfig } from "../helpers/test-config.js";

const databaseName = "ciudadaniaseguraya_test_integration";
const config = createTestConfig(databaseName);
const client = new MongoClient(config.mongodbUri);

describe("inicializacion MongoDB", () => {
  beforeAll(async () => {
    await client.connect();
    await initializeDatabase({ config, client });
    await initializeDatabase({ config, client });
  });

  afterAll(async () => {
    await client.close();
  });

  it("es idempotente y crea las 14 colecciones", async () => {
    const collections = await client
      .db(databaseName)
      .listCollections({}, { nameOnly: true })
      .toArray();
    expect(collections.map(({ name }) => name).sort()).toEqual(
      [
        "app_settings",
        "admin_refresh_tokens",
        "admin_role_requests",
        "audit_logs",
        "cities",
        "comments",
        "hex_monthly_stats",
        "incident_confirmations",
        "incident_reports",
        "incidents",
        "posts",
        "reactions",
        "refresh_tokens",
        "users",
      ].sort(),
    );
  });

  it("crea indices TTL, geoespacial y unicos", async () => {
    const db = client.db(databaseName);
    const [refreshIndexes, incidentIndexes, userIndexes] = await Promise.all([
      db.collection("refresh_tokens").indexes(),
      db.collection("incidents").indexes(),
      db.collection("users").indexes(),
    ]);

    expect(
      refreshIndexes.some(
        ({ name, expireAfterSeconds }) =>
          name === "expires_at_ttl" && expireAfterSeconds === 0,
      ),
    ).toBe(true);
    expect(
      incidentIndexes.some(({ name }) => name === "location_2dsphere"),
    ).toBe(true);
    expect(
      [4, 5, 6, 7, 8, 9].every((resolution) =>
        incidentIndexes.some(
          ({ name }) =>
            name === `city_h3_${resolution}_occurred_at`,
        ),
      ),
    ).toBe(true);
    expect(
      userIndexes.some(
        ({ name, unique }) =>
          name === "normalized_email_unique" && unique === true,
      ),
    ).toBe(true);
    expect(
      userIndexes.some(
        ({ name, unique, partialFilterExpression }) =>
          name === "google_subject_unique" &&
          unique === true &&
          partialFilterExpression?.googleSubject?.$type === "string",
      ),
    ).toBe(true);
  });

  it("siembra limites, centro y bounds reales para Bogota", async () => {
    const city = await client.db(databaseName).collection("cities").findOne({
      slug: "bogota",
      countryCode: "CO",
    });

    expect(city).toMatchObject({
      boundary: {
        type: "MultiPolygon",
        coordinates: expect.any(Array),
      },
      center: {
        type: "Point",
        coordinates: [-74.0721, 4.711],
      },
      bounds: {
        west: -74.2235137,
        south: 4.465596,
        east: -74.0101412,
        north: 4.8332542,
      },
      boundarySource: {
        license: "ODbL-1.0",
      },
    });
  });

  it("hace cumplir los indices unicos", async () => {
    const users = client.db(databaseName).collection("users");
    await users.deleteMany({
      normalizedEmail: "integration-unique@example.test",
    });
    const now = new Date();
    const document = {
      email: "integration-unique@example.test",
      normalizedEmail: "integration-unique@example.test",
      username: "integration_unique",
      normalizedUsername: "integration_unique",
      passwordHash: "$argon2id$test",
      role: "user",
      status: "active",
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      lastLoginAt: null,
    };
    const duplicateDocument = { ...document };
    await users.insertOne(document);
    await expect(
      users.insertOne({
        ...duplicateDocument,
        username: "integration_unique_2",
        normalizedUsername: "integration_unique_2",
      }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("crea el superadministrador una sola vez con Argon2id", async () => {
    const adminConfig = {
      ...config,
      superadminEmail: "integration-admin@example.test",
      superadminUsername: "integration_admin",
      superadminPassword: "Clave-Integracion-2026",
      superadminDisplayName: "Superadmin Integracion",
    };
    const users = client.db(databaseName).collection("users");
    await users.deleteMany({
      normalizedEmail: adminConfig.superadminEmail,
    });

    const first = await seedSuperadmin({ config: adminConfig, client });
    const second = await seedSuperadmin({ config: adminConfig, client });
    const admin = await users.findOne({
      normalizedEmail: adminConfig.superadminEmail,
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.status).toBe("unchanged");
    expect(admin.role).toBe("superadmin");
    expect(admin.adminMetadata.isBootstrapSuperadmin).toBe(true);
    expect(admin.passwordHash).toMatch(/^\$argon2id\$/);
  });
});
