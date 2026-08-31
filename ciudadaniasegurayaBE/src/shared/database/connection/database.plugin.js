import fp from "fastify-plugin";
import { MongoClient } from "mongodb";

async function databasePlugin(app, options) {
  const ownsClient = !options.client;
  const client =
    options.client ??
    new MongoClient(app.config.mongodbUri, {
      appName: "ciudadaniasegurayabe",
      maxPoolSize: 20,
      minPoolSize: 0,
      serverSelectionTimeoutMS: 5_000,
      connectTimeoutMS: 10_000,
    });

  if (ownsClient) {
    await client.connect();
  }

  const db = options.db ?? client.db(app.config.mongodbDbName);
  await db.command({ ping: 1, maxTimeMS: 5_000 });

  app.decorate("mongoClient", client);
  app.decorate("db", db);

  app.addHook("onClose", async () => {
    app.cache.clear();
    if (ownsClient) {
      await client.close();
    }
  });
}

export default fp(databasePlugin, {
  name: "database",
  fastify: "5.x",
});
