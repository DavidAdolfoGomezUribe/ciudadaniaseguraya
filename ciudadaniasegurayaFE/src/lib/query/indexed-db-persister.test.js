import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

import { publicEnv } from "@/lib/validation/env.schema";

import { createIndexedDbPersister } from "./indexed-db-persister";

const storage = vi.hoisted(() => ({
  del: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
}));

vi.mock("idb-keyval", () => storage);

const now = 1_800_000_000_000;

function storedClient(overrides = {}) {
  return {
    cacheVersion: publicEnv.cacheVersion,
    buildId: publicEnv.cacheBuildId,
    savedAt: now - 1_000,
    client: { timestamp: now - 1_000, clientState: { queries: [] } },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("indexedDB", {});
  vi.spyOn(Date, "now").mockReturnValue(now);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("createIndexedDbPersister", () => {
  it("persiste el cliente con versión, build y fecha de guardado", async () => {
    const client = { timestamp: now, clientState: { queries: [] } };

    await createIndexedDbPersister().persistClient(client);

    expect(storage.set).toHaveBeenCalledWith(
      "csy-public-query-cache",
      expect.objectContaining({
        cacheVersion: publicEnv.cacheVersion,
        buildId: publicEnv.cacheBuildId,
        savedAt: now,
        client,
      }),
    );
  });

  it("restaura únicamente una entrada vigente del mismo build", async () => {
    const stored = storedClient();
    storage.get.mockResolvedValue(stored);

    await expect(createIndexedDbPersister().restoreClient()).resolves.toEqual(
      stored.client,
    );
    expect(storage.del).not.toHaveBeenCalled();
  });

  it("no restaura sobre consultas creadas durante el primer render", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["visible"], { source: "first-render" });
    const visibleQueryHash = queryClient
      .getQueryCache()
      .find({ queryKey: ["visible"] }).queryHash;
    const visiblePersistedQuery = {
      queryHash: visibleQueryHash,
      state: { data: { source: "indexed-db" } },
    };
    const inactivePersistedQuery = {
      queryHash: JSON.stringify(["inactive"]),
      state: { data: { source: "indexed-db" } },
    };
    const stored = storedClient({
      client: {
        timestamp: now - 1_000,
        clientState: {
          queries: [visiblePersistedQuery, inactivePersistedQuery],
        },
      },
    });
    storage.get.mockResolvedValue(stored);

    const restored = await createIndexedDbPersister(queryClient).restoreClient();

    expect(restored.clientState.queries).toEqual([inactivePersistedQuery]);
    expect(stored.client.clientState.queries).toEqual([
      visiblePersistedQuery,
      inactivePersistedQuery,
    ]);
    expect(queryClient.getQueryData(["visible"])).toEqual({
      source: "first-render",
    });
  });

  it.each([
    ["versión distinta", { cacheVersion: "old" }],
    ["build distinto", { buildId: "previous-build" }],
    ["entrada expirada", { savedAt: now - publicEnv.cacheMaxAgeMs - 1 }],
  ])("elimina una entrada por %s", async (_reason, overrides) => {
    storage.get.mockResolvedValue(storedClient(overrides));

    await expect(createIndexedDbPersister().restoreClient()).resolves.toBeUndefined();
    expect(storage.del).toHaveBeenCalledWith("csy-public-query-cache");
  });

  it("se recupera de una base corrupta sin bloquear la aplicación", async () => {
    storage.get.mockRejectedValue(new Error("IndexedDB corrupta"));

    await expect(createIndexedDbPersister().restoreClient()).resolves.toBeUndefined();
    expect(storage.del).toHaveBeenCalledWith("csy-public-query-cache");
  });

  it("degrada a memoria cuando IndexedDB no existe", async () => {
    vi.stubGlobal("indexedDB", undefined);
    const persister = createIndexedDbPersister();

    await expect(persister.restoreClient()).resolves.toBeUndefined();
    await expect(persister.persistClient({})).resolves.toBeUndefined();
    await expect(persister.removeClient()).resolves.toBeUndefined();
    expect(storage.get).not.toHaveBeenCalled();
    expect(storage.set).not.toHaveBeenCalled();
    expect(storage.del).not.toHaveBeenCalled();
  });
});
