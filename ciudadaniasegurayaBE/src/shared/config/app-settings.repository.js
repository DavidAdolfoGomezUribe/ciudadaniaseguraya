export function createAppSettingsRepository(db) {
  const collection = db.collection("app_settings");

  return Object.freeze({
    async getValue(key, fallback) {
      const setting = await collection.findOne(
        { key },
        { projection: { value: 1 } },
      );
      return setting?.value ?? fallback;
    },
  });
}
