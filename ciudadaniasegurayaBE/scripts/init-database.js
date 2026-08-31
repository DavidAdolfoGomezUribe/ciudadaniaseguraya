import "dotenv/config";

import { loadConfig } from "../src/shared/config/env.js";
import { initializeDatabase } from "../src/shared/database/initialize.js";

async function run() {
  const config = loadConfig();
  const { cityId } = await initializeDatabase({ config });
  console.info(`Base de datos inicializada. Ciudad: ${cityId.toHexString()}`);
}

run().catch((error) => {
  console.error(`No fue posible inicializar la base de datos: ${error.message}`);
  process.exitCode = 1;
});
