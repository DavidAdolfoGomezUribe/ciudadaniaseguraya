import { describe, expect, it, vi } from "vitest";

import {
  adminLoginAttemptKey,
  createAdminLoginBackoff,
} from "../security/admin-login-backoff.js";

describe("backoff del login administrativo", () => {
  it("usa una llave irreversible que combina identificador e IP", () => {
    const key = adminLoginAttemptKey("Admin@Example.test", "127.0.0.1");

    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(key).not.toContain("admin@example.test");
  });

  it("aumenta el retraso despues de cada fallo", async () => {
    const wait = vi.fn(async () => {});
    const backoff = createAdminLoginBackoff({
      wait,
      baseDelayMs: 100,
      maximumDelayMs: 1_000,
    });

    backoff.registerFailure("key");
    await backoff.beforeAttempt("key");
    backoff.registerFailure("key");
    await backoff.beforeAttempt("key");

    expect(wait.mock.calls).toEqual([[100], [200]]);
  });

  it("bloquea temporalmente sin revelar si la cuenta existe", async () => {
    let now = 1_000;
    const backoff = createAdminLoginBackoff({
      clock: () => now,
      wait: vi.fn(async () => {}),
      blockAfterFailures: 2,
      blockDurationMs: 5_000,
    });

    backoff.registerFailure("key");
    backoff.registerFailure("key");

    await expect(backoff.beforeAttempt("key")).rejects.toMatchObject({
      code: "ADMIN_LOGIN_TEMPORARILY_BLOCKED",
      statusCode: 429,
    });

    now += 5_001;
    await expect(backoff.beforeAttempt("key")).resolves.toBeUndefined();
  });
});
