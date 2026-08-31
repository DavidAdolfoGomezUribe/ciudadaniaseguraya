import "dotenv/config";

import { pathToFileURL } from "node:url";
import { MongoClient } from "mongodb";
import { z } from "zod";

import { loadConfig } from "../src/shared/config/env.js";
import { syncSuperadmin } from "../src/shared/database/sync-superadmin.js";

const seedConfigSchema = z.object({
  mongodbUri: z.string().regex(/^mongodb(\+srv)?:\/\//),
  mongodbDbName: z.string().min(1).max(64),
  superadminEmail: z.email(),
  superadminUsername: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[A-Za-z0-9_.-]+$/),
  superadminPassword: z.string().min(12).max(128),
  superadminDisplayName: z.string().trim().min(2).max(100).optional(),
});

export async function seedSuperadmin({
  config: rawConfig,
  client: providedClient,
  clock = () => new Date(),
} = {}) {
  const parsed = seedConfigSchema.safeParse({
    ...rawConfig,
    superadminDisplayName: rawConfig?.superadminDisplayName || undefined,
  });
  if (!parsed.success) {
    const fields = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .join(", ");
    throw new Error(
      `Variables del seed de superadmin invalidas o ausentes: ${fields}`,
    );
  }
  const config = parsed.data;
  const ownsClient = !providedClient;
  const client =
    providedClient ??
    new MongoClient(config.mongodbUri, {
      appName: "ciudadaniasegurayabe-superadmin-seed",
      serverSelectionTimeoutMS: 10_000,
    });

  try {
    if (ownsClient) {
      await client.connect();
    }

    const result = await syncSuperadmin({
      config,
      db: client.db(config.mongodbDbName),
      clock,
    });
    return {
      ...result,
      created: result.status === "created",
    };
  } finally {
    if (ownsClient) {
      await client.close();
    }
  }
}

async function run() {
  const result = await seedSuperadmin({ config: loadConfig() });
  console.info(
    result.status === "created"
      ? "Superadministrador creado correctamente."
      : result.status === "unchanged"
        ? "Superadministrador ya sincronizado."
        : "Superadministrador actualizado sin crear duplicados.",
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  run().catch((error) => {
    console.error(`No fue posible crear el superadministrador: ${error.message}`);
    process.exitCode = 1;
  });
}
