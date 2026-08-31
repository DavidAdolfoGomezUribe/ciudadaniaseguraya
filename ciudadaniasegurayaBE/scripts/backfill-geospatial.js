import "dotenv/config";

import { pathToFileURL } from "node:url";
import { MongoClient } from "mongodb";

import { backfillGeospatialData } from "../src/modules/geolocation/services/geospatial-backfill.service.js";
import { loadConfig } from "../src/shared/config/env.js";
import { initializeDatabase } from "../src/shared/database/initialize.js";

export async function runGeospatialBackfill({
  config,
  client: providedClient,
} = {}) {
  if (!config) {
    throw new Error("runGeospatialBackfill requiere una configuracion");
  }

  const ownsClient = !providedClient;
  const client =
    providedClient ??
    new MongoClient(config.mongodbUri, {
      appName: "ciudadaniasegurayabe-geospatial-backfill",
      serverSelectionTimeoutMS: 10_000,
    });

  try {
    if (ownsClient) {
      await client.connect();
    }

    await initializeDatabase({ config, client });
    const result = await backfillGeospatialData({
      db: client.db(config.mongodbDbName),
      config,
    });
    return result;
  } finally {
    if (ownsClient) {
      await client.close();
    }
  }
}

async function run() {
  const result = await runGeospatialBackfill({
    config: loadConfig(),
  });
  console.info(
    [
      "Backfill geoespacial completado.",
      `Incidentes procesados: ${result.processedIncidents}.`,
      `Incidentes actualizados: ${result.updatedIncidents}.`,
      `Celdas estadisticas: ${result.statisticsCells}.`,
      `Agregados obsoletos eliminados: ${result.removedStaleStatistics}.`,
    ].join(" "),
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  run().catch((error) => {
    console.error(
      `No fue posible completar el backfill geoespacial: ${error.message}`,
    );
    process.exitCode = 1;
  });
}
