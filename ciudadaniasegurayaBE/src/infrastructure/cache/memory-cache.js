export function createCacheProvider({ clock = () => Date.now() } = {}) {
  const entries = new Map();

  return Object.freeze({
    get(key) {
      const entry = entries.get(key);

      if (!entry) {
        return undefined;
      }

      if (entry.expiresAt <= clock()) {
        entries.delete(key);
        return undefined;
      }

      return entry.value;
    },
    set(key, value, ttlMs = 60_000) {
      entries.set(key, {
        value,
        expiresAt: clock() + ttlMs,
      });
    },
    delete(key) {
      entries.delete(key);
    },
    clear() {
      entries.clear();
    },
  });
}
