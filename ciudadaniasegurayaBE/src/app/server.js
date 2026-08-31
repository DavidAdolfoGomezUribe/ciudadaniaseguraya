import "dotenv/config";

import { buildApp } from "./app.js";
import { loadConfig } from "../shared/config/env.js";
import { initializeDatabase } from "../shared/database/initialize.js";
import { syncSuperadmin } from "../shared/database/sync-superadmin.js";

let app;
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  app?.log.info({ signal }, "shutting down");

  try {
    await app?.close();
  } catch (error) {
    app?.log.error({ err: error }, "graceful shutdown failed");
    process.exitCode = 1;
  }
}

async function start() {
  const config = loadConfig();
  app = await buildApp({ config });
  await initializeDatabase({ config, client: app.mongoClient });
  app.log.info("database schema initialized");
  const superadminSync = await syncSuperadmin({ config, db: app.db });
  app.log.info(
    { status: superadminSync.status, userId: superadminSync.userId },
    "superadmin synchronization completed",
  );

  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });

  await app.listen({
    host: config.host,
    port: config.port,
  });

  app.log.info(
    {
      host: config.host,
      port: config.port,
      docs: `${config.publicApiBaseUrl}/docs`,
    },
    "server started",
  );
}

start().catch((error) => {
  if (app) {
    app.log.fatal({ err: error }, "server startup failed");
  } else {
    process.stderr.write(`No fue posible iniciar el servidor: ${error.message}\n`);
  }
  process.exitCode = 1;
});
