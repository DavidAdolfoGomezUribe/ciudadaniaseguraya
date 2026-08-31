import { createHmac, randomBytes } from "node:crypto";

const durationMultipliers = Object.freeze({
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
});

export function durationToMilliseconds(duration) {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(duration);

  if (!match) {
    throw new Error("Duracion de token invalida");
  }

  return Number(match[1]) * durationMultipliers[match[2]];
}

export function createRefreshToken() {
  return randomBytes(48).toString("base64url");
}

export function hashRefreshToken(token, secret) {
  return createHmac("sha256", secret).update(token).digest("hex");
}
