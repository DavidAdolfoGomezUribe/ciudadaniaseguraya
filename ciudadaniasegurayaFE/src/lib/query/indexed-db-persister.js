import { del, get, set } from "idb-keyval";

import { publicEnv } from "@/lib/validation/env.schema";

const CACHE_KEY = "csy-public-query-cache";

function excludeRenderedQueries(client, queryClient) {
  const persistedQueries = client?.clientState?.queries;
  if (!queryClient || !Array.isArray(persistedQueries)) return client;

  const renderedQueryHashes = new Set(
    queryClient
      .getQueryCache()
      .getAll()
      .map((query) => query.queryHash),
  );
  if (renderedQueryHashes.size === 0) return client;

  const restorableQueries = persistedQueries.filter(
    (query) => !renderedQueryHashes.has(query.queryHash),
  );
  if (restorableQueries.length === persistedQueries.length) return client;

  return {
    ...client,
    clientState: {
      ...client.clientState,
      queries: restorableQueries,
    },
  };
}

export function createIndexedDbPersister(queryClient) {
  return {
    async persistClient(client) {
      if (typeof indexedDB === "undefined") return;
      try {
        await set(CACHE_KEY, {
          cacheVersion: publicEnv.cacheVersion,
          buildId: publicEnv.cacheBuildId,
          savedAt: Date.now(),
          client,
        });
      } catch {
        // TanStack Query remains available through its in-memory cache.
      }
    },
    async restoreClient() {
      if (typeof indexedDB === "undefined") return undefined;
      try {
        const stored = await get(CACHE_KEY);
        const expired =
          !stored ||
          stored.cacheVersion !== publicEnv.cacheVersion ||
          stored.buildId !== publicEnv.cacheBuildId ||
          Date.now() - stored.savedAt > publicEnv.cacheMaxAgeMs;

        if (expired) {
          await del(CACHE_KEY);
          return undefined;
        }
        // Queries created by the first render own the hydration result. Restoring
        // an older snapshot over them can change markup while React is hydrating.
        // Inactive cache entries remain available for later navigation/offline use.
        return excludeRenderedQueries(stored.client, queryClient);
      } catch {
        try {
          await del(CACHE_KEY);
        } catch {
          // The app can continue without persistent storage.
        }
        return undefined;
      }
    },
    async removeClient() {
      if (typeof indexedDB === "undefined") return;
      try {
        await del(CACHE_KEY);
      } catch {
        // Removal failure must not prevent the application from starting.
      }
    },
  };
}
