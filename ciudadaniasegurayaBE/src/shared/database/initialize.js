import { MongoClient, ObjectId } from "mongodb";

import {
  buildIndexDefinitions,
  collectionDefinitions,
} from "./schema.js";
import { defaultCityGeography } from "../../modules/geolocation/constants/bogota-geography.js";
import { HEATMAP_SCALE } from "../../modules/geolocation/constants/heatmap.js";
import { slugify } from "../utils/normalization.js";

async function createOrUpdateCollections(db) {
  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(
      ({ name }) => name,
    ),
  );

  for (const definition of collectionDefinitions) {
    const options = {
      validator: definition.validator,
      validationLevel: "strict",
      validationAction: "error",
    };

    if (!existing.has(definition.name)) {
      await db.createCollection(definition.name, options);
      continue;
    }

    await db.command({
      collMod: definition.name,
      ...options,
    });
  }
}

async function createIndexes(db, config) {
  const indexes = buildIndexDefinitions(config);

  for (const [collectionName, definitions] of Object.entries(indexes)) {
    await db.collection(collectionName).createIndexes(definitions);
  }
}

async function seedDefaults(db, config, now) {
  const citySlug = slugify(config.defaultCityName);
  const geography = defaultCityGeography({
    slug: citySlug,
    countryCode: config.defaultCityCountryCode,
  });
  const cityResult = await db.collection("cities").findOneAndUpdate(
    {
      slug: citySlug,
      countryCode: config.defaultCityCountryCode,
    },
    {
      $setOnInsert: {
        ...(config.defaultCityId
          ? { _id: new ObjectId(config.defaultCityId) }
          : {}),
        name: config.defaultCityName,
        slug: citySlug,
        countryCode: config.defaultCityCountryCode,
        timezone: config.cityTimezone,
        active: true,
        boundary: geography?.boundary ?? null,
        center: geography?.center ?? null,
        bounds: geography?.bounds ?? null,
        boundarySource: geography?.boundarySource ?? null,
        createdAt: now,
        updatedAt: now,
      },
    },
    {
      upsert: true,
      returnDocument: "after",
    },
  );

  if (geography) {
    await db.collection("cities").updateOne(
      {
        _id: cityResult._id,
        $or: [
          { boundary: null },
          { boundary: { $exists: false } },
        ],
      },
      {
        $set: {
          ...geography,
          updatedAt: now,
        },
      },
    );
  }

  const settings = [
    {
      key: "incidentConfirmationThreshold",
      value: config.incidentConfirmationThreshold,
    },
    {
      key: "incidentMatchWindowMinutes",
      value: config.incidentMatchWindowMinutes,
    },
    {
      key: "h3SupportedResolutions",
      value: config.h3SupportedResolutions,
      managed: true,
    },
    {
      key: "heatmapScale",
      value: HEATMAP_SCALE,
      managed: true,
    },
  ];

  await db.collection("app_settings").bulkWrite(
    settings.map((setting) => ({
      updateOne: {
        filter: { key: setting.key },
        update: setting.managed
          ? {
              $set: {
                value: setting.value,
                updatedAt: now,
              },
              $setOnInsert: {
                key: setting.key,
                createdAt: now,
              },
            }
          : {
              $setOnInsert: {
                key: setting.key,
                value: setting.value,
                createdAt: now,
                updatedAt: now,
              },
            },
        upsert: true,
      },
    })),
  );

  return cityResult;
}

export async function initializeDatabase({
  config,
  client: providedClient,
  now = new Date(),
} = {}) {
  if (!config) {
    throw new Error("initializeDatabase requiere una configuracion validada");
  }

  const ownsClient = !providedClient;
  const client =
    providedClient ??
    new MongoClient(config.mongodbUri, {
      appName: "ciudadaniasegurayabe-db-init",
      serverSelectionTimeoutMS: 10_000,
    });

  try {
    if (ownsClient) {
      await client.connect();
    }

    const db = client.db(config.mongodbDbName);
    await createOrUpdateCollections(db);
    await createIndexes(db, config);
    const city = await seedDefaults(db, config, now);

    return {
      db,
      cityId: city._id,
    };
  } finally {
    if (ownsClient) {
      await client.close();
    }
  }
}
