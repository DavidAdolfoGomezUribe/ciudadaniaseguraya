import { createHash } from "node:crypto";

import { AppError } from "../../../../shared/errors/app-error.js";

function temporarilyBlocked() {
  return new AppError({
    code: "ADMIN_LOGIN_TEMPORARILY_BLOCKED",
    message: "Demasiados intentos. Intenta nuevamente mas tarde.",
    statusCode: 429,
  });
}

export function adminLoginAttemptKey(identifier, ipAddress = "") {
  return createHash("sha256")
    .update(`${ipAddress}\0${identifier.trim().normalize("NFKC").toLowerCase()}`)
    .digest("hex");
}

export function createAdminLoginBackoff({
  clock = () => Date.now(),
  wait = (milliseconds) =>
    new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    }),
  baseDelayMs = 200,
  maximumDelayMs = 2_000,
  blockAfterFailures = 5,
  blockDurationMs = 15 * 60_000,
  retentionMs = 30 * 60_000,
  maximumEntries = 10_000,
} = {}) {
  const attempts = new Map();

  function prune(now) {
    for (const [key, entry] of attempts) {
      if (
        entry.lastFailureAt + retentionMs <= now &&
        (entry.blockedUntil ?? 0) <= now
      ) {
        attempts.delete(key);
      }
    }
    while (attempts.size >= maximumEntries) {
      attempts.delete(attempts.keys().next().value);
    }
  }

  async function beforeAttempt(key) {
    const now = clock();
    prune(now);
    const entry = attempts.get(key);
    if (!entry) {
      return;
    }
    if ((entry.blockedUntil ?? 0) > now) {
      throw temporarilyBlocked();
    }
    if (entry.failures > 0) {
      const delay = Math.min(
        baseDelayMs * 2 ** (entry.failures - 1),
        maximumDelayMs,
      );
      await wait(delay);
    }
  }

  function registerFailure(key) {
    const now = clock();
    prune(now);
    const previous = attempts.get(key);
    const failures = (previous?.failures ?? 0) + 1;
    attempts.delete(key);
    attempts.set(key, {
      failures,
      lastFailureAt: now,
      blockedUntil:
        failures >= blockAfterFailures ? now + blockDurationMs : null,
    });
  }

  function clear(key) {
    attempts.delete(key);
  }

  return Object.freeze({
    beforeAttempt,
    registerFailure,
    clear,
  });
}
