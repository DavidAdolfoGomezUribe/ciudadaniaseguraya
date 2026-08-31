import { describe, expect, it } from "vitest";

import { loadConfig } from "../../config/env.js";
import {
  createRefreshToken,
  durationToMilliseconds,
  hashRefreshToken,
} from "../tokens.js";

describe("configuracion y tokens", () => {
  it.each([
    ["15m", 900_000],
    ["7d", 604_800_000],
    ["30s", 30_000],
  ])("convierte %s a milisegundos", (duration, expected) => {
    expect(durationToMilliseconds(duration)).toBe(expected);
  });

  it("genera tokens opacos y hashes HMAC estables", () => {
    const token = createRefreshToken();
    const first = hashRefreshToken(token, "secret-one");
    const second = hashRefreshToken(token, "secret-one");

    expect(token.length).toBeGreaterThanOrEqual(64);
    expect(first).toBe(second);
    expect(first).not.toContain(token);
    expect(hashRefreshToken(token, "secret-two")).not.toBe(first);
  });

  it("falla al faltar secretos criticos", () => {
    expect(() =>
      loadConfig({
        MONGODB_URI: "mongodb://localhost:27017",
      }),
    ).toThrow("JWT_ACCESS_SECRET");
  });

  it("acepta la clave MongoDB heredada sin exponerla", () => {
    const config = loadConfig({
      NODE_ENV: "test",
      MONGODB: "mongodb://localhost:27017",
      JWT_ACCESS_SECRET: "a".repeat(32),
      JWT_REFRESH_SECRET: "b".repeat(32),
    });
    expect(config.mongodbUri).toBe("mongodb://localhost:27017");
  });
});
