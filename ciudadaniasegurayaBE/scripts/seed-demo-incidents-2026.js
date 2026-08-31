import "dotenv/config";

import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { MongoClient, ObjectId } from "mongodb";

import { seedSuperadmin } from "./seed-superadmin.js";
import { INCIDENT_TYPE_CODES } from "../src/modules/incidents/constants/incident-types.js";
import {
  h3Cell,
  h3CellsForResolutions,
  toGeoJsonPoint,
} from "../src/modules/geolocation/h3/h3.js";
import { pointBelongsToBoundary } from "../src/modules/geolocation/providers/city-boundary.js";
import { backfillGeospatialData } from "../src/modules/geolocation/services/geospatial-backfill.service.js";
import { loadConfig } from "../src/shared/config/env.js";
import { initializeDatabase } from "../src/shared/database/initialize.js";

export const DEMO_INCIDENTS_BATCH_ID =
  "bogota-2026-annual-heatmap-v1";
const DEMO_COVERAGE_BATCH_ID =
  "bogota-2026-annual-heatmap-neighbor-gradient-v1";
export const DEMO_INCIDENTS_YEAR_START =
  "2026-01-01T05:00:00.000Z";
export const DEMO_INCIDENTS_REPORTING_DELAY_MS = 15 * 60 * 1_000;

export const DEMO_HOTSPOTS = Object.freeze(
  [
    ["usaquen", "Usaquén", 4.7008, -74.0302, 35],
    ["chapinero", "Chapinero", 4.6486, -74.0628, 30],
    ["suba", "Suba", 4.741, -74.084, 28],
    ["engativa", "Engativá", 4.702, -74.113, 25],
    ["fontibon", "Fontibón", 4.678, -74.14, 22],
    ["kennedy", "Kennedy", 4.626, -74.153, 20],
    ["bosa", "Bosa", 4.615, -74.19, 18],
    ["ciudad-bolivar", "Ciudad Bolívar", 4.57, -74.15, 16],
    ["tunjuelito", "Tunjuelito", 4.59, -74.136, 14],
    ["rafael-uribe", "Rafael Uribe Uribe", 4.58, -74.116, 12],
    ["san-cristobal", "San Cristóbal", 4.56, -74.09, 10],
    ["santa-fe", "Santa Fe", 4.605, -74.07, 8],
    ["teusaquillo", "Teusaquillo", 4.645, -74.09, 5],
    ["barrios-unidos", "Barrios Unidos", 4.67, -74.074, 4],
    ["los-martires", "Los Mártires", 4.604, -74.09, 2],
    ["puente-aranda", "Puente Aranda", 4.62, -74.11, 1],
  ].map(([id, name, latitude, longitude, incidentCount]) =>
    Object.freeze({
      id,
      name,
      latitude,
      longitude,
      incidentCount,
    }),
  ),
);

export const DEMO_INCIDENTS_TOTAL = DEMO_HOTSPOTS.reduce(
  (total, hotspot) => total + hotspot.incidentCount,
  0,
);

const DEMO_INCIDENT_TYPES = Object.freeze([
  "robo",
  "hurto",
  "atraco",
  "vandalismo",
  "actividad_sospechosa",
  "agresion",
  "extorsion",
  "otro",
]);
const DEMO_YEAR_END = new Date("2027-01-01T04:59:59.999Z");
const GOLDEN_ANGLE_RADIANS = Math.PI * (3 - Math.sqrt(5));

function deterministicObjectId(batchId, sequence) {
  const bytes = createHash("sha256")
    .update(`${batchId}:${sequence}`)
    .digest()
    .subarray(0, 12);
  return new ObjectId(bytes);
}

function assertSeedInputs({ city, adminId, config, now }) {
  if (
    !city?._id ||
    city.slug !== "bogota" ||
    city.countryCode !== "CO" ||
    city.active !== true ||
    !city.boundary
  ) {
    throw new Error(
      "El seed requiere la ciudad activa de Bogota con limites geograficos",
    );
  }
  if (!ObjectId.isValid(adminId)) {
    throw new Error("El seed requiere un administrador valido");
  }
  if (
    !Number.isInteger(config?.h3BaseResolution) ||
    !Array.isArray(config?.h3SupportedResolutions) ||
    !config.h3SupportedResolutions.includes(config.h3BaseResolution)
  ) {
    throw new Error("La configuracion H3 del seed no es valida");
  }
  if (
    !(now instanceof Date) ||
    !Number.isFinite(now.getTime()) ||
    now.getTime() <
      new Date(DEMO_INCIDENTS_YEAR_START).getTime() +
        DEMO_INCIDENTS_REPORTING_DELAY_MS
  ) {
    throw new Error("La fecha del seed debe ser posterior al inicio de 2026");
  }
}

function validateHotspots(city, baseResolution) {
  const indexes = new Set();

  for (const hotspot of DEMO_HOTSPOTS) {
    const point = toGeoJsonPoint(hotspot);
    if (!pointBelongsToBoundary(point, city.boundary)) {
      throw new Error(
        `El hotspot ${hotspot.id} no pertenece a los limites de Bogota`,
      );
    }

    const index = h3Cell(
      hotspot.latitude,
      hotspot.longitude,
      baseResolution,
    );
    if (indexes.has(index)) {
      throw new Error(
        `Los hotspots no son unicos en la resolucion H3 ${baseResolution}`,
      );
    }
    indexes.add(index);
  }
}

function orderedAssignments() {
  return DEMO_HOTSPOTS.flatMap((hotspot, hotspotIndex) =>
    Array.from({ length: hotspot.incidentCount }, (_, localIndex) => ({
      hotspot,
      hotspotIndex,
      localIndex,
      relativePosition:
        hotspot.incidentCount === 1
          ? 0
          : localIndex / (hotspot.incidentCount - 1),
    })),
  ).sort(
    (left, right) =>
      left.relativePosition - right.relativePosition ||
      left.hotspotIndex - right.hotspotIndex,
  );
}

function occurrenceAt(sequence, now) {
  const start = new Date(DEMO_INCIDENTS_YEAR_START).getTime();
  const end = Math.min(
    now.getTime() - DEMO_INCIDENTS_REPORTING_DELAY_MS,
    DEMO_YEAR_END.getTime() - DEMO_INCIDENTS_REPORTING_DELAY_MS,
  );
  const offset =
    ((end - start) * (sequence - 1)) /
    Math.max(1, DEMO_INCIDENTS_TOTAL - 1);
  return new Date(start + Math.floor(offset));
}

function locationForAssignment(
  { hotspot, hotspotIndex, localIndex },
  city,
  baseResolution,
) {
  const anchorIndex = h3Cell(
    hotspot.latitude,
    hotspot.longitude,
    baseResolution,
  );

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const angle =
      (localIndex + 1) * GOLDEN_ANGLE_RADIANS +
      hotspotIndex +
      attempt * (Math.PI / 4);
    const radius =
      0.000025 + ((localIndex + attempt) % 6) * 0.000018;
    const latitude = hotspot.latitude + Math.sin(angle) * radius;
    const longitude = hotspot.longitude + Math.cos(angle) * radius;
    const point = toGeoJsonPoint({ latitude, longitude });

    if (
      pointBelongsToBoundary(point, city.boundary) &&
      h3Cell(latitude, longitude, baseResolution) === anchorIndex
    ) {
      return { latitude, longitude, point };
    }
  }

  return {
    latitude: hotspot.latitude,
    longitude: hotspot.longitude,
    point: toGeoJsonPoint(hotspot),
  };
}

export function buildDemoIncidentDocuments({
  city,
  adminId,
  config,
  now = new Date(),
  batchId = DEMO_INCIDENTS_BATCH_ID,
} = {}) {
  assertSeedInputs({ city, adminId, config, now });
  validateHotspots(city, config.h3BaseResolution);

  return orderedAssignments().map((assignment, index) => {
    const sequence = index + 1;
    const occurredAt = occurrenceAt(sequence, now);
    const reportedAt = new Date(
      occurredAt.getTime() + DEMO_INCIDENTS_REPORTING_DELAY_MS,
    );
    const { latitude, longitude, point } = locationForAssignment(
      assignment,
      city,
      config.h3BaseResolution,
    );
    const h3Cells = h3CellsForResolutions(
      latitude,
      longitude,
      config.h3SupportedResolutions,
    );
    const incidentType =
      DEMO_INCIDENT_TYPES[(sequence - 1) % DEMO_INCIDENT_TYPES.length];

    if (!INCIDENT_TYPE_CODES.includes(incidentType)) {
      throw new Error(`Tipo de incidente no soportado: ${incidentType}`);
    }

    return {
      _id: deterministicObjectId(batchId, sequence),
      cityId: city._id,
      incidentType,
      title: `Incidente sintetico de demostracion ${String(sequence).padStart(3, "0")}`,
      description:
        "Registro sintetico persistido para validar el mapa anual H3; no representa un hecho real.",
      occurredAt,
      reportedAt,
      location: point,
      locationPrecision: "approximate",
      address: null,
      neighborhood: assignment.hotspot.name,
      h3Index: h3Cells[String(config.h3BaseResolution)],
      h3Resolution: config.h3BaseResolution,
      h3Cells,
      sourceUrls: [],
      status: "admin_verified",
      verification: {
        method: "admin",
        confirmationCount: 0,
        verifiedAt: reportedAt,
        verifiedBy: adminId,
      },
      createdBy: adminId,
      createdByRole: "superadmin",
      statisticsApplied: false,
      createdAt: reportedAt,
      updatedAt: reportedAt,
      deletedAt: null,
      mergedInto: null,
      seedMetadata: {
        batchId,
        sequence,
        synthetic: true,
        purpose: "annual-heatmap-demo",
        hotspotId: assignment.hotspot.id,
        hotspotName: assignment.hotspot.name,
      },
    };
  });
}

export async function seedDemoIncidents2026({
  config,
  client: providedClient,
  now = new Date(),
} = {}) {
  if (!config) {
    throw new Error("seedDemoIncidents2026 requiere una configuracion");
  }

  const ownsClient = !providedClient;
  const client =
    providedClient ??
    new MongoClient(config.mongodbUri, {
      appName: "ciudadaniasegurayabe-demo-incidents-seed",
      serverSelectionTimeoutMS: 10_000,
    });

  try {
    if (ownsClient) {
      await client.connect();
    }

    const existingDatabase = client.db(config.mongodbDbName);
    const coverageLayoutCount = await existingDatabase
      .collection("incidents")
      .countDocuments({
        $or: [
          { "seedMetadata.batchId": DEMO_COVERAGE_BATCH_ID },
          {
            "seedMetadata.redistribution.batchId":
              DEMO_COVERAGE_BATCH_ID,
          },
        ],
      });
    if (coverageLayoutCount > 0) {
      throw new Error(
        "El layout de cobertura ya esta activo; usa db:seed:demo-neighbor-incidents:2026 para reconciliarlo",
      );
    }

    const { cityId } = await initializeDatabase({ config, client, now });
    const adminSeed = await seedSuperadmin({ config, client });
    const db = client.db(config.mongodbDbName);
    const [city, admin] = await Promise.all([
      db.collection("cities").findOne({
        _id: cityId,
        slug: "bogota",
        countryCode: "CO",
        active: true,
      }),
      db.collection("users").findOne({
        _id: adminSeed.userId,
        role: "superadmin",
        status: "active",
      }),
    ]);

    if (!admin) {
      throw new Error("El administrador configurado no esta activo");
    }

    const documents = buildDemoIncidentDocuments({
      city,
      adminId: admin._id,
      config,
      now,
    });
    const incidents = db.collection("incidents");
    const writeResult = await incidents.bulkWrite(
      documents.map((document) => ({
        replaceOne: {
          filter: {
            _id: document._id,
            "seedMetadata.batchId": DEMO_INCIDENTS_BATCH_ID,
          },
          replacement: document,
          upsert: true,
        },
      })),
      { ordered: true },
    );
    const backfill = await backfillGeospatialData({
      db,
      config,
      clock: () => now,
    });
    const persistedCount = await incidents.countDocuments({
      "seedMetadata.batchId": DEMO_INCIDENTS_BATCH_ID,
      "seedMetadata.synthetic": true,
    });

    if (persistedCount !== DEMO_INCIDENTS_TOTAL) {
      throw new Error(
        `El lote sintetico contiene ${persistedCount} registros; se esperaban ${DEMO_INCIDENTS_TOTAL}`,
      );
    }

    return {
      batchId: DEMO_INCIDENTS_BATCH_ID,
      total: persistedCount,
      matched: writeResult.matchedCount,
      upserted: writeResult.upsertedCount,
      cityId,
      adminId: admin._id,
      from: documents[0].occurredAt,
      to: documents.at(-1).occurredAt,
      backfill,
    };
  } finally {
    if (ownsClient) {
      await client.close();
    }
  }
}

async function run() {
  const result = await seedDemoIncidents2026({
    config: loadConfig(),
  });
  console.info(
    [
      "Seed sintetico de incidentes completado.",
      `Lote: ${result.batchId}.`,
      `Registros: ${result.total}.`,
      `Creados: ${result.upserted}.`,
      `Reemplazados: ${result.matched}.`,
      `Periodo: ${result.from.toISOString()} a ${result.to.toISOString()}.`,
      `Celdas estadisticas: ${result.backfill.statisticsCells}.`,
    ].join(" "),
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  run().catch((error) => {
    console.error(
      `No fue posible crear los incidentes sinteticos: ${error.message}`,
    );
    process.exitCode = 1;
  });
}
