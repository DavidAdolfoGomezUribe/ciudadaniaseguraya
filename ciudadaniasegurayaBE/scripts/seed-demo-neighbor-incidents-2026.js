import "dotenv/config";

import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { cellToParent, polygonToCells } from "h3-js";
import { MongoClient, ObjectId } from "mongodb";

import {
  DEMO_HOTSPOTS,
  DEMO_INCIDENTS_BATCH_ID,
  DEMO_INCIDENTS_REPORTING_DELAY_MS,
  DEMO_INCIDENTS_TOTAL,
  DEMO_INCIDENTS_YEAR_START,
} from "./seed-demo-incidents-2026.js";
import { INCIDENT_TYPE_CODES } from "../src/modules/incidents/constants/incident-types.js";
import { heatmapStyle } from "../src/modules/geolocation/constants/heatmap.js";
import {
  h3Cell,
  h3CellsForResolutions,
  h3Center,
  neighboringCells,
  toGeoJsonPoint,
} from "../src/modules/geolocation/h3/h3.js";
import { pointBelongsToBoundary } from "../src/modules/geolocation/providers/city-boundary.js";
import { backfillGeospatialData } from "../src/modules/geolocation/services/geospatial-backfill.service.js";
import { loadConfig } from "../src/shared/config/env.js";
import { monthInTimezone } from "../src/shared/utils/time.js";

export const DEMO_NEIGHBOR_INCIDENTS_BATCH_ID =
  "bogota-2026-annual-heatmap-neighbor-gradient-v1";
export const DEMO_NEIGHBOR_INCIDENTS_TOTAL = 1_000;
export const DEMO_NEIGHBOR_H3_RESOLUTION = 9;
export const DEMO_REFERENCE_H3_INDEX = "8966e42f2abffff";
export const DEMO_REFERENCE_FINAL_COUNT = 30;
export const DEMO_REFERENCE_NEIGHBOR_COUNTS = Object.freeze([
  18, 18, 18, 17, 17, 17,
]);
export const DEMO_BASE_RELOCATION_SEQUENCES = Object.freeze([
  30, 78, 125, 173, 222,
]);
export const DEMO_COVERAGE_CELLS_TOTAL = 900;
export const DEMO_NEW_COVERAGE_INCIDENTS_TOTAL = 895;
export const DEMO_EXPECTED_POPULATED_CELLS = 922;

const DEMO_REQUIRED_HOTSPOT_NEIGHBORS_TOTAL = 90;
const DEMO_STRATIFIED_COVERAGE_CELLS_TOTAL =
  DEMO_COVERAGE_CELLS_TOTAL - DEMO_REQUIRED_HOTSPOT_NEIGHBORS_TOTAL;
const DEMO_COVERAGE_PARENT_RESOLUTION = 8;
const DEMO_COVERAGE_SELECTION_SEED = "bogota-2026-city-coverage-layout-v2";
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

function identifier(value) {
  return value?.toHexString?.() ?? String(value);
}

function sameIdentifier(left, right) {
  return identifier(left) === identifier(right);
}

function sameDate(left, right) {
  return (
    left instanceof Date &&
    right instanceof Date &&
    left.getTime() === right.getTime()
  );
}

function sortedH3Cells(h3Cells) {
  return Object.fromEntries(
    Object.entries(h3Cells ?? {}).sort(([left], [right]) =>
      left.localeCompare(right, "en", { numeric: true }),
    ),
  );
}

function sameJsonValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function deterministicRank(values, scope) {
  return values
    .map((value) => ({
      value,
      score: createHash("sha256")
        .update(`${DEMO_COVERAGE_SELECTION_SEED}:${scope}:${value}`)
        .digest("hex"),
    }))
    .sort(
      (left, right) =>
        left.score.localeCompare(right.score) ||
        left.value.localeCompare(right.value),
    )
    .map(({ value }) => value);
}

function assertSeedInputs({ city, adminId, adminRole, config, now }) {
  if (
    !city?._id ||
    city.slug !== "bogota" ||
    city.countryCode !== "CO" ||
    city.active !== true ||
    !city.boundary
  ) {
    throw new Error(
      "El seed de cobertura requiere la ciudad activa de Bogota con limites geograficos",
    );
  }
  if (!ObjectId.isValid(adminId)) {
    throw new Error("El seed de cobertura requiere un administrador valido");
  }
  if (!["admin", "superadmin"].includes(adminRole)) {
    throw new Error(
      "El seed de cobertura requiere un rol administrativo valido",
    );
  }
  if (
    config?.h3BaseResolution !== DEMO_NEIGHBOR_H3_RESOLUTION ||
    !Array.isArray(config?.h3SupportedResolutions) ||
    !config.h3SupportedResolutions.includes(config.h3BaseResolution)
  ) {
    throw new Error(
      `El seed de cobertura requiere H3 base ${DEMO_NEIGHBOR_H3_RESOLUTION}`,
    );
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

function boundaryPolygons(boundary) {
  if (boundary?.type === "Polygon") {
    return [boundary.coordinates];
  }
  if (boundary?.type === "MultiPolygon") {
    return boundary.coordinates;
  }
  throw new Error("El limite de Bogota no es un poligono GeoJSON valido");
}

function hotspotLayouts(baseResolution) {
  return DEMO_HOTSPOTS.map((hotspot) => {
    const anchorH3Index = h3Cell(
      hotspot.latitude,
      hotspot.longitude,
      baseResolution,
    );
    const neighbors = neighboringCells(anchorH3Index, 1)
      .filter((index) => index !== anchorH3Index)
      .sort((left, right) => left.localeCompare(right));

    if (neighbors.length !== 6) {
      throw new Error(
        `El hotspot ${hotspot.id} no tiene seis vecinos H3 inmediatos`,
      );
    }

    return {
      hotspot,
      anchorH3Index,
      neighbors,
      disk: [anchorH3Index, ...neighbors],
    };
  });
}

export function selectDemoCoverageCells({
  city,
  baseResolution = DEMO_NEIGHBOR_H3_RESOLUTION,
} = {}) {
  if (!city?.boundary) {
    throw new Error("La seleccion de cobertura requiere limites de Bogota");
  }
  if (baseResolution !== DEMO_NEIGHBOR_H3_RESOLUTION) {
    throw new Error(
      `La seleccion de cobertura requiere H3 ${DEMO_NEIGHBOR_H3_RESOLUTION}`,
    );
  }

  const layouts = hotspotLayouts(baseResolution);
  const reserved = new Set(layouts.flatMap(({ disk }) => disk));
  const requiredHotspotNeighbors = layouts
    .filter(({ anchorH3Index }) => anchorH3Index !== DEMO_REFERENCE_H3_INDEX)
    .flatMap(({ neighbors }) => neighbors);

  if (
    requiredHotspotNeighbors.length !==
    DEMO_REQUIRED_HOTSPOT_NEIGHBORS_TOTAL
  ) {
    throw new Error("La reserva vecinal de hotspots no tiene 90 celdas");
  }

  const boundaryCells = [
    ...new Set(
      boundaryPolygons(city.boundary).flatMap((polygon) =>
        polygonToCells(polygon, baseResolution, true),
      ),
    ),
  ];
  const eligibleCells = boundaryCells.filter((index) => {
    if (reserved.has(index)) {
      return false;
    }
    return pointBelongsToBoundary(h3Center(index).point, city.boundary);
  });
  const cellsByParent = new Map();

  for (const index of eligibleCells) {
    const parent = cellToParent(
      index,
      DEMO_COVERAGE_PARENT_RESOLUTION,
    );
    const cells = cellsByParent.get(parent) ?? [];
    cells.push(index);
    cellsByParent.set(parent, cells);
  }

  const parentGroups = deterministicRank(
    [...cellsByParent.keys()],
    "parent",
  ).map((parent) =>
    deterministicRank(cellsByParent.get(parent), `parent:${parent}`),
  );
  const stratifiedCells = [];

  for (
    let round = 0;
    stratifiedCells.length < DEMO_STRATIFIED_COVERAGE_CELLS_TOTAL;
    round += 1
  ) {
    let added = 0;

    for (const cells of parentGroups) {
      if (cells[round]) {
        stratifiedCells.push(cells[round]);
        added += 1;
      }
      if (
        stratifiedCells.length ===
        DEMO_STRATIFIED_COVERAGE_CELLS_TOTAL
      ) {
        break;
      }
    }

    if (added === 0) {
      throw new Error(
        `Bogota no contiene ${DEMO_STRATIFIED_COVERAGE_CELLS_TOTAL} celdas H3 elegibles`,
      );
    }
  }

  const coverageCells = [
    ...stratifiedCells,
    ...deterministicRank(requiredHotspotNeighbors, "required-neighbor"),
  ];
  const referenceDisk = new Set(
    neighboringCells(DEMO_REFERENCE_H3_INDEX, 1),
  );
  const anchors = new Set(
    layouts.map(({ anchorH3Index }) => anchorH3Index),
  );

  if (
    coverageCells.length !== DEMO_COVERAGE_CELLS_TOTAL ||
    new Set(coverageCells).size !== DEMO_COVERAGE_CELLS_TOTAL ||
    coverageCells.some(
      (index) =>
        anchors.has(index) ||
        referenceDisk.has(index) ||
        !pointBelongsToBoundary(h3Center(index).point, city.boundary),
    ) ||
    requiredHotspotNeighbors.some(
      (index) => !coverageCells.includes(index),
    )
  ) {
    throw new Error(
      "La cobertura de Bogota no produjo 900 celdas validas y unicas",
    );
  }

  for (const resolution of [6, 7, 8]) {
    const boundaryParents = new Set(
      boundaryCells.map((index) => cellToParent(index, resolution)),
    );
    const coverageParents = new Set(
      coverageCells.map((index) => cellToParent(index, resolution)),
    );
    if (
      coverageParents.size !== boundaryParents.size ||
      [...boundaryParents].some(
        (parent) => !coverageParents.has(parent),
      )
    ) {
      throw new Error(
        `La cobertura no alcanza todos los padres H3 de resolucion ${resolution}`,
      );
    }
  }

  return coverageCells;
}

function referenceNeighbors() {
  const neighbors = neighboringCells(DEMO_REFERENCE_H3_INDEX, 1)
    .filter((index) => index !== DEMO_REFERENCE_H3_INDEX)
    .sort((left, right) => left.localeCompare(right));

  if (neighbors.length !== DEMO_REFERENCE_NEIGHBOR_COUNTS.length) {
    throw new Error("La celda de referencia no tiene seis vecinos H3");
  }

  return neighbors;
}

function orderedAssignments(coverageCells) {
  const neighbors = referenceNeighbors();
  const neighborAssignments = neighbors.flatMap((targetH3Index, cellIndex) => {
    const count = DEMO_REFERENCE_NEIGHBOR_COUNTS[cellIndex];
    return Array.from({ length: count }, (_, localIndex) => ({
      distribution: "reference-neighbor",
      targetH3Index,
      cellIndex,
      localIndex,
      spatialIndex: cellIndex,
      relativePosition: localIndex / Math.max(1, count - 1),
    }));
  });
  const newCoverageCells = coverageCells.slice(
    DEMO_BASE_RELOCATION_SEQUENCES.length,
  );
  const coverageAssignments = newCoverageCells.map(
    (targetH3Index, coverageOrdinal) => ({
      distribution: "bogota-coverage",
      targetH3Index,
      cellIndex: coverageOrdinal,
      localIndex: 0,
      spatialIndex:
        coverageOrdinal + DEMO_BASE_RELOCATION_SEQUENCES.length,
      relativePosition:
        coverageOrdinal / Math.max(1, newCoverageCells.length - 1),
      coverageOrdinal:
        coverageOrdinal + DEMO_BASE_RELOCATION_SEQUENCES.length,
    }),
  );
  const assignments = [
    ...neighborAssignments,
    ...coverageAssignments,
  ].sort(
    (left, right) =>
      left.relativePosition - right.relativePosition ||
      left.distribution.localeCompare(right.distribution) ||
      left.cellIndex - right.cellIndex ||
      left.localIndex - right.localIndex,
  );

  if (
    coverageAssignments.length !== DEMO_NEW_COVERAGE_INCIDENTS_TOTAL ||
    assignments.length !== DEMO_NEIGHBOR_INCIDENTS_TOTAL
  ) {
    throw new Error(
      `La distribucion genero ${assignments.length} registros; se esperaban ${DEMO_NEIGHBOR_INCIDENTS_TOTAL}`,
    );
  }

  return assignments;
}

function occurrenceAt(sequence, now) {
  const start = new Date(DEMO_INCIDENTS_YEAR_START).getTime();
  const end = Math.min(
    now.getTime() - DEMO_INCIDENTS_REPORTING_DELAY_MS,
    DEMO_YEAR_END.getTime() - DEMO_INCIDENTS_REPORTING_DELAY_MS,
  );
  const offset =
    ((end - start) * (sequence - 1)) /
    Math.max(1, DEMO_NEIGHBOR_INCIDENTS_TOTAL - 1);
  return new Date(start + Math.floor(offset));
}

function locationForCell({ targetH3Index, seed }, city, baseResolution) {
  const center = h3Center(targetH3Index);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const angle =
      (seed + 1) * GOLDEN_ANGLE_RADIANS +
      attempt * (Math.PI / 6);
    const radius = 0.00002 + ((seed + attempt) % 6) * 0.000015;
    const latitude = center.latitude + Math.sin(angle) * radius;
    const longitude = center.longitude + Math.cos(angle) * radius;
    const point = toGeoJsonPoint({ latitude, longitude });

    if (
      pointBelongsToBoundary(point, city.boundary) &&
      h3Cell(latitude, longitude, baseResolution) === targetH3Index
    ) {
      return { latitude, longitude, point };
    }
  }

  return center;
}

export function buildDemoNeighborIncidentDocuments({
  city,
  adminId,
  adminRole = "superadmin",
  config,
  now = new Date(),
  batchId = DEMO_NEIGHBOR_INCIDENTS_BATCH_ID,
  coverageCells = selectDemoCoverageCells({
    city,
    baseResolution: config?.h3BaseResolution,
  }),
} = {}) {
  assertSeedInputs({ city, adminId, adminRole, config, now });
  const assignments = orderedAssignments(coverageCells);

  return assignments.map((assignment, index) => {
    const sequence = index + 1;
    const occurredAt = occurrenceAt(sequence, now);
    const reportedAt = new Date(
      occurredAt.getTime() + DEMO_INCIDENTS_REPORTING_DELAY_MS,
    );
    const { latitude, longitude, point } = locationForCell(
      {
        targetH3Index: assignment.targetH3Index,
        seed: sequence + assignment.spatialIndex,
      },
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
      title: `Incidente sintetico distribuido ${String(sequence).padStart(4, "0")}`,
      description:
        "Registro sintetico para validar cobertura territorial H3; no representa un hecho real.",
      occurredAt,
      reportedAt,
      location: point,
      locationPrecision: "approximate",
      address: null,
      neighborhood:
        assignment.distribution === "reference-neighbor"
          ? "Entorno de Usaquen"
          : null,
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
      createdByRole: adminRole,
      statisticsApplied: false,
      createdAt: reportedAt,
      updatedAt: reportedAt,
      deletedAt: null,
      mergedInto: null,
      seedMetadata: {
        batchId,
        sequence,
        synthetic: true,
        purpose: "annual-heatmap-city-coverage",
        layoutVersion: 2,
        distribution: assignment.distribution,
        referenceH3Index: DEMO_REFERENCE_H3_INDEX,
        assignedH3Index: assignment.targetH3Index,
        ring:
          assignment.distribution === "reference-neighbor" ? 1 : null,
        coverageOrdinal: assignment.coverageOrdinal ?? null,
      },
    };
  });
}

function validateVisibleBaseDocument(document, city, baseResolution) {
  const yearStart = new Date(DEMO_INCIDENTS_YEAR_START).getTime();
  const yearEnd = DEMO_YEAR_END.getTime();
  const [longitude, latitude] = document.location?.coordinates ?? [];

  if (
    !ObjectId.isValid(document._id) ||
    !sameIdentifier(document.cityId, city._id) ||
    document.status !== "admin_verified" ||
    document.deletedAt !== null ||
    document.mergedInto !== null ||
    !(document.occurredAt instanceof Date) ||
    document.occurredAt.getTime() < yearStart ||
    document.occurredAt.getTime() > yearEnd ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    !pointBelongsToBoundary(document.location, city.boundary) ||
    h3Cell(latitude, longitude, baseResolution) !== document.h3Index ||
    document.h3Cells?.[String(baseResolution)] !== document.h3Index
  ) {
    throw new Error(
      "El lote base contiene un registro invalido o no visible en Bogota durante 2026",
    );
  }
}

export function validateDemoBaseBatchDocuments(
  documents,
  {
    city,
    baseResolution = DEMO_NEIGHBOR_H3_RESOLUTION,
    coverageCells,
  } = {},
) {
  if (!Array.isArray(documents)) {
    throw new Error("Los documentos del lote base no son validos");
  }
  if (documents.length !== DEMO_INCIDENTS_TOTAL) {
    throw new Error(
      `El lote base contiene ${documents.length} registros; se esperaban ${DEMO_INCIDENTS_TOTAL}`,
    );
  }
  if (!city?._id || !city.boundary) {
    throw new Error("La ciudad esperada para el lote base no es valida");
  }
  if (
    !Array.isArray(coverageCells) ||
    coverageCells.length !== DEMO_COVERAGE_CELLS_TOTAL
  ) {
    throw new Error("La validacion base requiere 900 celdas de cobertura");
  }

  const layouts = new Map(
    hotspotLayouts(baseResolution).map((layout) => [
      layout.hotspot.id,
      layout,
    ]),
  );
  const expectedRelocations = new Map(
    DEMO_BASE_RELOCATION_SEQUENCES.map((sequence, index) => [
      sequence,
      coverageCells[index],
    ]),
  );
  const observedHotspots = new Map();
  const observedSequences = new Set();
  const actors = new Map();
  const relocationDocuments = [];

  for (const document of documents) {
    validateVisibleBaseDocument(document, city, baseResolution);

    if (
      document.seedMetadata?.batchId !== DEMO_INCIDENTS_BATCH_ID ||
      document.seedMetadata?.synthetic !== true
    ) {
      throw new Error("El lote base contiene un registro no sintetico");
    }

    const sequence = document.seedMetadata.sequence;
    if (
      !Number.isInteger(sequence) ||
      sequence < 1 ||
      sequence > DEMO_INCIDENTS_TOTAL ||
      observedSequences.has(sequence) ||
      !sameIdentifier(
        document._id,
        deterministicObjectId(DEMO_INCIDENTS_BATCH_ID, sequence),
      )
    ) {
      throw new Error("El lote base no conserva sus secuencias e IDs");
    }
    observedSequences.add(sequence);

    const hotspotId = document.seedMetadata.hotspotId;
    const layout = layouts.get(hotspotId);
    if (!layout) {
      throw new Error(
        `El lote base contiene un hotspot inesperado: ${hotspotId ?? "sin-id"}`,
      );
    }
    observedHotspots.set(
      hotspotId,
      (observedHotspots.get(hotspotId) ?? 0) + 1,
    );

    if (!ObjectId.isValid(document.createdBy)) {
      throw new Error("El lote base no tiene un administrador valido");
    }
    const actorId =
      document.createdBy instanceof ObjectId
        ? document.createdBy
        : new ObjectId(document.createdBy);
    if (
      document.verification?.method !== "admin" ||
      !sameIdentifier(document.verification?.verifiedBy, actorId)
    ) {
      throw new Error("El lote base no conserva su verificacion administrativa");
    }
    actors.set(actorId.toHexString(), actorId);

    const relocationTarget = expectedRelocations.get(sequence);
    if (!relocationTarget) {
      if (
        document.h3Index !== layout.anchorH3Index ||
        document.seedMetadata.redistribution != null
      ) {
        throw new Error(
          `El lote base no conserva la celda central del hotspot ${hotspotId}`,
        );
      }
      continue;
    }

    if (
      hotspotId !== "usaquen" ||
      layout.anchorH3Index !== DEMO_REFERENCE_H3_INDEX
    ) {
      throw new Error(
        `La secuencia base ${sequence} no pertenece a la referencia de Usaquen`,
      );
    }

    const isPending = document.h3Index === DEMO_REFERENCE_H3_INDEX;
    const redistribution = document.seedMetadata.redistribution;
    const redistributionKeys = Object.keys(redistribution ?? {}).sort();
    const isRelocated =
      document.h3Index === relocationTarget &&
      redistribution?.batchId === DEMO_NEIGHBOR_INCIDENTS_BATCH_ID &&
      redistribution?.layoutVersion === 2 &&
      redistribution?.purpose === "bogota-city-coverage" &&
      redistribution?.originalH3Index === DEMO_REFERENCE_H3_INDEX &&
      redistribution?.assignedH3Index === relocationTarget &&
      sameJsonValue(redistributionKeys, [
        "assignedH3Index",
        "batchId",
        "layoutVersion",
        "originalH3Index",
        "purpose",
      ]);

    if (!isPending && !isRelocated) {
      throw new Error(
        `La secuencia base ${sequence} tiene una redistribucion inesperada`,
      );
    }
    if (isPending && redistribution != null) {
      throw new Error(
        `La secuencia base ${sequence} tiene metadatos de redistribucion inconsistentes`,
      );
    }

    relocationDocuments.push({
      document,
      sequence,
      targetH3Index: relocationTarget,
      needsUpdate: isPending,
    });
  }

  for (const { hotspot } of layouts.values()) {
    if (observedHotspots.get(hotspot.id) !== hotspot.incidentCount) {
      throw new Error(
        `El lote base no conserva la cantidad esperada para ${hotspot.id}`,
      );
    }
  }
  if (actors.size !== 1) {
    throw new Error(
      "El lote base debe pertenecer a un unico administrador",
    );
  }
  if (
    relocationDocuments.length !== DEMO_BASE_RELOCATION_SEQUENCES.length
  ) {
    throw new Error("El lote base no contiene las cinco secuencias migrables");
  }

  relocationDocuments.sort((left, right) => left.sequence - right.sequence);

  return {
    adminId: actors.values().next().value,
    documents,
    relocationDocuments,
    relocatedCount: relocationDocuments.filter(
      ({ needsUpdate }) => !needsUpdate,
    ).length,
  };
}

async function loadBaseBatchState(
  db,
  { city, baseResolution, coverageCells },
) {
  const documents = await db
    .collection("incidents")
    .find(
      {
        "seedMetadata.batchId": DEMO_INCIDENTS_BATCH_ID,
      },
      {
        projection: {
          createdBy: 1,
          createdByRole: 1,
          cityId: 1,
          status: 1,
          verification: 1,
          deletedAt: 1,
          mergedInto: 1,
          occurredAt: 1,
          location: 1,
          h3Index: 1,
          h3Cells: 1,
          seedMetadata: 1,
        },
      },
    )
    .toArray();

  return validateDemoBaseBatchDocuments(documents, {
    city,
    baseResolution,
    coverageCells,
  });
}

async function activeAdministrator(db, adminId) {
  const admin = await db.collection("users").findOne(
    {
      _id: adminId,
      role: { $in: ["admin", "superadmin"] },
      status: "active",
      deletedAt: null,
    },
    {
      projection: {
        _id: 1,
        role: 1,
      },
    },
  );

  if (!admin) {
    throw new Error(
      "El administrador del lote base ya no esta activo o no tiene rol administrativo",
    );
  }

  return admin;
}

function baseRedistributionOperations({
  baseState,
  city,
  config,
  now,
}) {
  return baseState.relocationDocuments
    .filter(({ needsUpdate }) => needsUpdate)
    .map(({ document, sequence, targetH3Index }) => {
      const { latitude, longitude, point } = locationForCell(
        {
          targetH3Index,
          seed: DEMO_NEIGHBOR_INCIDENTS_TOTAL + sequence,
        },
        city,
        config.h3BaseResolution,
      );
      const h3Cells = h3CellsForResolutions(
        latitude,
        longitude,
        config.h3SupportedResolutions,
      );

      return {
        updateOne: {
          filter: {
            _id: document._id,
            "seedMetadata.batchId": DEMO_INCIDENTS_BATCH_ID,
            "seedMetadata.sequence": sequence,
            h3Index: DEMO_REFERENCE_H3_INDEX,
            status: "admin_verified",
            deletedAt: null,
          },
          update: {
            $set: {
              location: point,
              locationPrecision: "approximate",
              address: null,
              neighborhood: null,
              h3Index: h3Cells[String(config.h3BaseResolution)],
              h3Resolution: config.h3BaseResolution,
              h3Cells,
              statisticsApplied: false,
              updatedAt: now,
              "seedMetadata.redistribution": {
                batchId: DEMO_NEIGHBOR_INCIDENTS_BATCH_ID,
                layoutVersion: 2,
                purpose: "bogota-city-coverage",
                originalH3Index: DEMO_REFERENCE_H3_INDEX,
                assignedH3Index: targetH3Index,
              },
            },
          },
        },
      };
    });
}

function expectedBaseH3Index(document, coverageCells) {
  const relocationIndex = DEMO_BASE_RELOCATION_SEQUENCES.indexOf(
    document.seedMetadata.sequence,
  );
  return relocationIndex === -1
    ? document.h3Index
    : coverageCells[relocationIndex];
}

export function summarizeDemoCoverageLayout({
  baseDocuments,
  neighborDocuments,
  coverageCells,
} = {}) {
  if (
    !Array.isArray(baseDocuments) ||
    baseDocuments.length !== DEMO_INCIDENTS_TOTAL ||
    !Array.isArray(neighborDocuments) ||
    neighborDocuments.length !== DEMO_NEIGHBOR_INCIDENTS_TOTAL
  ) {
    throw new Error("El resumen requiere ambos lotes sinteticos completos");
  }

  const finalCells = [
    ...baseDocuments.map((document) =>
      expectedBaseH3Index(document, coverageCells),
    ),
    ...neighborDocuments.map(({ h3Index }) => h3Index),
  ];
  const counts = new Map();
  for (const index of finalCells) {
    counts.set(index, (counts.get(index) ?? 0) + 1);
  }

  const neighbors = referenceNeighbors();
  const neighborCounts = neighbors.map((index) => counts.get(index) ?? 0);
  const newCoverageDocuments = neighborDocuments.filter(
    ({ seedMetadata }) =>
      seedMetadata.distribution === "bogota-coverage",
  );

  if (
    finalCells.length !==
      DEMO_INCIDENTS_TOTAL + DEMO_NEIGHBOR_INCIDENTS_TOTAL ||
    counts.get(DEMO_REFERENCE_H3_INDEX) !== DEMO_REFERENCE_FINAL_COUNT ||
    neighborCounts.some(
      (count, index) => count !== DEMO_REFERENCE_NEIGHBOR_COUNTS[index],
    ) ||
    coverageCells.some((index) => counts.get(index) !== 1) ||
    newCoverageDocuments.length !== DEMO_NEW_COVERAGE_INCIDENTS_TOTAL ||
    counts.size !== DEMO_EXPECTED_POPULATED_CELLS
  ) {
    throw new Error("La distribucion sintetica final no cumple el layout esperado");
  }

  return {
    total: finalCells.length,
    referenceCount: counts.get(DEMO_REFERENCE_H3_INDEX),
    neighborCounts,
    coverageCells: coverageCells.length,
    populatedCells: counts.size,
    coverageParentsResolution8: new Set(
      coverageCells.map((index) => cellToParent(index, 8)),
    ).size,
    coverageParentsResolution7: new Set(
      coverageCells.map((index) => cellToParent(index, 7)),
    ).size,
    coverageParentsResolution6: new Set(
      coverageCells.map((index) => cellToParent(index, 6)),
    ).size,
  };
}

async function assertBatchIdentityAvailable(db, documents) {
  const expectedIds = new Set(
    documents.map(({ _id }) => _id.toHexString()),
  );
  const existingBatchDocuments = await db
    .collection("incidents")
    .find(
      {
        "seedMetadata.batchId": DEMO_NEIGHBOR_INCIDENTS_BATCH_ID,
      },
      { projection: { _id: 1 } },
    )
    .toArray();

  if (
    existingBatchDocuments.some(
      ({ _id }) => !expectedIds.has(_id.toHexString()),
    )
  ) {
    throw new Error("El lote de cobertura contiene IDs no reconocidos");
  }

  const conflictingDocument = await db.collection("incidents").findOne(
    {
      _id: { $in: documents.map(({ _id }) => _id) },
      "seedMetadata.batchId": {
        $ne: DEMO_NEIGHBOR_INCIDENTS_BATCH_ID,
      },
    },
    { projection: { _id: 1 } },
  );

  if (conflictingDocument) {
    throw new Error(
      `El ID ${conflictingDocument._id.toHexString()} pertenece a otro lote`,
    );
  }
}

function incidentPersistenceSignature(document) {
  return {
    _id: identifier(document._id),
    cityId: identifier(document.cityId),
    incidentType: document.incidentType,
    title: document.title,
    description: document.description,
    occurredAt: document.occurredAt?.getTime?.(),
    reportedAt: document.reportedAt?.getTime?.(),
    location: document.location,
    locationPrecision: document.locationPrecision,
    address: document.address,
    neighborhood: document.neighborhood,
    h3Index: document.h3Index,
    h3Resolution: document.h3Resolution,
    h3Cells: sortedH3Cells(document.h3Cells),
    sourceUrls: document.sourceUrls,
    status: document.status,
    verification: {
      method: document.verification?.method,
      confirmationCount: document.verification?.confirmationCount,
      verifiedAt: document.verification?.verifiedAt?.getTime?.(),
      verifiedBy: identifier(document.verification?.verifiedBy),
    },
    createdBy: identifier(document.createdBy),
    createdByRole: document.createdByRole,
    statisticsApplied: document.statisticsApplied,
    createdAt: document.createdAt?.getTime?.(),
    updatedAt: document.updatedAt?.getTime?.(),
    deletedAt: document.deletedAt,
    mergedInto: document.mergedInto,
    seedMetadata: document.seedMetadata,
  };
}

function sortedIncidentTypes(incidentTypes) {
  return Object.fromEntries(
    Object.entries(incidentTypes ?? {}).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  );
}

export async function verifyDemoMonthlyStatistics({
  db,
  city,
  config,
  expectedUpdatedAt,
}) {
  if (!(expectedUpdatedAt instanceof Date)) {
    throw new Error("La verificacion estadistica requiere una fecha valida");
  }
  const expected = new Map();
  const timezone = city.timezone ?? config.cityTimezone;
  const cursor = db.collection("incidents").find(
    {
      cityId: city._id,
      status: { $in: ["community_confirmed", "admin_verified"] },
      deletedAt: null,
    },
    {
      projection: {
        incidentType: 1,
        occurredAt: 1,
        h3Cells: 1,
      },
    },
  );

  for await (const incident of cursor) {
    if (!(incident.occurredAt instanceof Date)) {
      throw new Error(
        `El incidente ${identifier(incident._id)} no tiene datos mensuales H3 validos`,
      );
    }

    const month = monthInTimezone(incident.occurredAt, timezone);
    for (const resolution of config.h3SupportedResolutions) {
      const h3Index = incident.h3Cells?.[String(resolution)];
      if (typeof h3Index !== "string") {
        throw new Error(
          `El incidente ${identifier(incident._id)} no tiene H3 ${resolution}`,
        );
      }

      const key = `${resolution}:${month}:${h3Index}`;
      const aggregate = expected.get(key) ?? {
        month,
        h3Resolution: resolution,
        h3Index,
        incidentCount: 0,
        incidentTypes: {},
      };
      aggregate.incidentCount += 1;
      aggregate.incidentTypes[incident.incidentType] =
        (aggregate.incidentTypes[incident.incidentType] ?? 0) + 1;
      expected.set(key, aggregate);
    }
  }

  const actual = await db
    .collection("hex_monthly_stats")
    .find(
      {
        cityId: city._id,
        h3Resolution: { $in: config.h3SupportedResolutions },
      },
      {
        projection: {
          cityId: 1,
          month: 1,
          h3Resolution: 1,
          h3Index: 1,
          incidentCount: 1,
          incidentTypes: 1,
          center: 1,
          level: 1,
          color: 1,
          lastUpdatedAt: 1,
        },
      },
    )
    .toArray();

  if (actual.length !== expected.size) {
    throw new Error(
      `Las estadisticas H3 mensuales contienen ${actual.length} celdas; se esperaban ${expected.size}`,
    );
  }

  for (const statistic of actual) {
    const key = `${statistic.h3Resolution}:${statistic.month}:${statistic.h3Index}`;
    const aggregate = expected.get(key);
    const style = aggregate
      ? heatmapStyle(aggregate.incidentCount)
      : null;
    if (
      !aggregate ||
      !sameIdentifier(statistic.cityId, city._id) ||
      statistic.h3Resolution !== aggregate.h3Resolution ||
      statistic.incidentCount !== aggregate.incidentCount ||
      !sameJsonValue(
        statistic.center,
        h3Center(statistic.h3Index).point,
      ) ||
      statistic.level !== style.level ||
      statistic.color !== style.color ||
      !sameDate(statistic.lastUpdatedAt, expectedUpdatedAt) ||
      !sameJsonValue(
        sortedIncidentTypes(statistic.incidentTypes),
        sortedIncidentTypes(aggregate.incidentTypes),
      )
    ) {
      throw new Error(
        `La estadistica mensual ${key} no coincide con los incidentes visibles`,
      );
    }
  }

  return {
    resolutions: [...config.h3SupportedResolutions],
    cells: actual.length,
  };
}

async function verifyPersistedLayout({
  db,
  city,
  config,
  coverageCells,
  expectedDocuments,
  expectedStatisticsUpdatedAt,
}) {
  const incidents = db.collection("incidents");
  const baseState = await loadBaseBatchState(db, {
    city,
    baseResolution: config.h3BaseResolution,
    coverageCells,
  });
  if (baseState.relocatedCount !== DEMO_BASE_RELOCATION_SEQUENCES.length) {
    throw new Error("La redistribucion de los cinco registros base no termino");
  }

  const actualDocuments = await incidents
    .find({
      "seedMetadata.batchId": DEMO_NEIGHBOR_INCIDENTS_BATCH_ID,
    })
    .toArray();
  if (actualDocuments.length !== DEMO_NEIGHBOR_INCIDENTS_TOTAL) {
    throw new Error(
      `El lote de cobertura contiene ${actualDocuments.length} registros; se esperaban ${DEMO_NEIGHBOR_INCIDENTS_TOTAL}`,
    );
  }

  const expectedById = new Map(
    expectedDocuments.map((document) => [
      document._id.toHexString(),
      document,
    ]),
  );
  for (const document of actualDocuments) {
    const expected = expectedById.get(document._id.toHexString());
    const [longitude, latitude] = document.location?.coordinates ?? [];
    const expectedPersisted = expected
      ? { ...expected, statisticsApplied: true }
      : null;
    if (
      !expected ||
      !sameJsonValue(
        incidentPersistenceSignature(document),
        incidentPersistenceSignature(expectedPersisted),
      ) ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      !pointBelongsToBoundary(document.location, city.boundary) ||
      h3Cell(latitude, longitude, config.h3BaseResolution) !==
        document.h3Index
    ) {
      throw new Error(
        `El documento ${document._id.toHexString()} no coincide con el layout persistido`,
      );
    }
  }

  const baseStatisticsPending = await incidents.countDocuments({
    "seedMetadata.batchId": DEMO_INCIDENTS_BATCH_ID,
    statisticsApplied: { $ne: true },
  });
  if (baseStatisticsPending !== 0) {
    throw new Error("El backfill no aplico todas las estadisticas del lote base");
  }

  const combinedBatchTotal = await incidents.countDocuments({
    "seedMetadata.batchId": {
      $in: [
        DEMO_INCIDENTS_BATCH_ID,
        DEMO_NEIGHBOR_INCIDENTS_BATCH_ID,
      ],
    },
  });
  const combinedVisibleSyntheticTotal = await incidents.countDocuments({
    cityId: city._id,
    "seedMetadata.batchId": {
      $in: [
        DEMO_INCIDENTS_BATCH_ID,
        DEMO_NEIGHBOR_INCIDENTS_BATCH_ID,
      ],
    },
    "seedMetadata.synthetic": true,
    status: "admin_verified",
    deletedAt: null,
    mergedInto: null,
    statisticsApplied: true,
  });
  const expectedCombinedTotal =
    DEMO_INCIDENTS_TOTAL + DEMO_NEIGHBOR_INCIDENTS_TOTAL;
  if (
    combinedBatchTotal !== expectedCombinedTotal ||
    combinedVisibleSyntheticTotal !== expectedCombinedTotal
  ) {
    throw new Error(
      "Los dos lotes no contienen 1250 registros sinteticos visibles y verificados",
    );
  }

  const statistics = await verifyDemoMonthlyStatistics({
    db,
    city,
    config,
    expectedUpdatedAt: expectedStatisticsUpdatedAt,
  });

  return {
    baseState,
    statistics,
    summary: summarizeDemoCoverageLayout({
      baseDocuments: baseState.documents,
      neighborDocuments: actualDocuments,
      coverageCells,
    }),
  };
}

export async function seedDemoNeighborIncidents2026({
  config,
  client: providedClient,
  now = new Date(),
  dryRun = false,
  allowProduction = false,
} = {}) {
  if (!config) {
    throw new Error(
      "seedDemoNeighborIncidents2026 requiere una configuracion",
    );
  }
  if (
    config.nodeEnv === "production" &&
    !dryRun &&
    allowProduction !== true
  ) {
    throw new Error(
      "La carga sintetica en produccion requiere ALLOW_SYNTHETIC_PRODUCTION_SEED=true",
    );
  }

  const ownsClient = !providedClient;
  const client =
    providedClient ??
    new MongoClient(config.mongodbUri, {
      appName: "ciudadaniasegurayabe-demo-city-coverage-seed",
      serverSelectionTimeoutMS: 10_000,
    });

  try {
    if (ownsClient) {
      await client.connect();
    }

    const db = client.db(config.mongodbDbName);
    const city = await db.collection("cities").findOne({
      slug: "bogota",
      countryCode: "CO",
      active: true,
    });
    if (!city?._id) {
      throw new Error(
        "El seed de cobertura requiere la ciudad activa de Bogota",
      );
    }

    const coverageCells = selectDemoCoverageCells({
      city,
      baseResolution: config.h3BaseResolution,
    });
    const baseState = await loadBaseBatchState(db, {
      city,
      baseResolution: config.h3BaseResolution,
      coverageCells,
    });
    const admin = await activeAdministrator(db, baseState.adminId);
    const documents = buildDemoNeighborIncidentDocuments({
      city,
      adminId: admin._id,
      adminRole: admin.role,
      config,
      now,
      coverageCells,
    });
    await assertBatchIdentityAvailable(db, documents);
    const summary = summarizeDemoCoverageLayout({
      baseDocuments: baseState.documents,
      neighborDocuments: documents,
      coverageCells,
    });
    const resultBase = {
      batchId: DEMO_NEIGHBOR_INCIDENTS_BATCH_ID,
      baseTotal: DEMO_INCIDENTS_TOTAL,
      total: documents.length,
      syntheticTotal: summary.total,
      cityId: city._id,
      adminId: admin._id,
      from: documents[0].occurredAt,
      to: documents.at(-1).occurredAt,
      baseRelocationsPending:
        DEMO_BASE_RELOCATION_SEQUENCES.length - baseState.relocatedCount,
      summary,
    };

    if (dryRun) {
      return {
        ...resultBase,
        dryRun: true,
        matched: 0,
        upserted: 0,
        baseRelocated: 0,
        backfill: null,
      };
    }

    const incidents = db.collection("incidents");
    const writeResult = await incidents.bulkWrite(
      documents.map((document) => ({
        replaceOne: {
          filter: {
            _id: document._id,
            "seedMetadata.batchId": DEMO_NEIGHBOR_INCIDENTS_BATCH_ID,
          },
          replacement: document,
          upsert: true,
        },
      })),
      { ordered: true },
    );
    const baseOperations = baseRedistributionOperations({
      baseState,
      city,
      config,
      now,
    });
    const baseWriteResult =
      baseOperations.length > 0
        ? await incidents.bulkWrite(baseOperations, { ordered: true })
        : { matchedCount: 0, modifiedCount: 0 };

    if (baseWriteResult.matchedCount !== baseOperations.length) {
      throw new Error(
        "No fue posible reconciliar todos los registros base seleccionados",
      );
    }

    const persistedCount = await incidents.countDocuments({
      "seedMetadata.batchId": DEMO_NEIGHBOR_INCIDENTS_BATCH_ID,
      "seedMetadata.synthetic": true,
    });
    if (persistedCount !== DEMO_NEIGHBOR_INCIDENTS_TOTAL) {
      throw new Error(
        `El lote de cobertura contiene ${persistedCount} registros; se esperaban ${DEMO_NEIGHBOR_INCIDENTS_TOTAL}`,
      );
    }

    const reconciledBaseState = await loadBaseBatchState(db, {
      city,
      baseResolution: config.h3BaseResolution,
      coverageCells,
    });
    if (
      reconciledBaseState.relocatedCount !==
      DEMO_BASE_RELOCATION_SEQUENCES.length
    ) {
      throw new Error("La redistribucion del lote base quedo incompleta");
    }

    const backfill = await backfillGeospatialData({
      db,
      config,
      clock: () => now,
    });
    const verification = await verifyPersistedLayout({
      db,
      city,
      config,
      coverageCells,
      expectedDocuments: documents,
      expectedStatisticsUpdatedAt: now,
    });

    return {
      ...resultBase,
      dryRun: false,
      total: persistedCount,
      matched: writeResult.matchedCount,
      upserted: writeResult.upsertedCount,
      baseRelocated: baseWriteResult.modifiedCount,
      baseRelocationsPending: 0,
      summary: verification.summary,
      statisticsVerification: verification.statistics,
      backfill,
    };
  } finally {
    if (ownsClient) {
      await client.close();
    }
  }
}

async function run() {
  const dryRun = process.argv.includes("--dry-run");
  const result = await seedDemoNeighborIncidents2026({
    config: loadConfig(),
    dryRun,
    allowProduction:
      process.env.ALLOW_SYNTHETIC_PRODUCTION_SEED === "true",
  });
  console.info(
    [
      result.dryRun
        ? "Validacion del seed de cobertura completada sin escrituras."
        : "Seed sintetico de cobertura completado.",
      `Lote base: ${result.baseTotal}.`,
      `Lote adicional: ${result.total}.`,
      `Total sintetico: ${result.syntheticTotal}.`,
      `Centro: ${result.summary.referenceCount}.`,
      `Vecinos: ${result.summary.neighborCounts.join(",")}.`,
      `Celdas de cobertura: ${result.summary.coverageCells}.`,
      `Celdas H3 pobladas: ${result.summary.populatedCells}.`,
      `Padres r8/r7/r6: ${result.summary.coverageParentsResolution8}/${result.summary.coverageParentsResolution7}/${result.summary.coverageParentsResolution6}.`,
      `Relocalizaciones base pendientes: ${result.baseRelocationsPending}.`,
      ...(result.dryRun
        ? []
        : [
            `Creados: ${result.upserted}.`,
            `Reemplazados: ${result.matched}.`,
            `Base relocalizados ahora: ${result.baseRelocated}.`,
            `Estadisticas r${result.statisticsVerification.resolutions.join(",")} verificadas: ${result.statisticsVerification.cells}.`,
          ]),
      `Periodo adicional: ${result.from.toISOString()} a ${result.to.toISOString()}.`,
      ...(result.dryRun
        ? []
        : [
            `Celdas estadisticas: ${result.backfill.statisticsCells}.`,
          ]),
    ].join(" "),
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  run().catch((error) => {
    console.error(
      `No fue posible crear la cobertura sintetica: ${error.message}`,
    );
    process.exitCode = 1;
  });
}
