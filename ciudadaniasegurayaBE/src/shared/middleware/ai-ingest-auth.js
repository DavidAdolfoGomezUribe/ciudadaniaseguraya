import { createHash, timingSafeEqual } from "node:crypto";

import { AppError } from "../errors/app-error.js";

function digest(value) {
  return createHash("sha256").update(value, "utf8").digest();
}

export function createAiIngestGuard({ apiKey }) {
  const expectedKey = apiKey ?? "";
  const expectedDigest = expectedKey ? digest(expectedKey) : null;

  return async function authenticateAiIngest(request) {
    if (!expectedDigest) {
      throw new AppError({
        code: "AI_INGEST_DISABLED",
        message: "La integracion de incidentes con IA no esta configurada",
        statusCode: 503,
      });
    }

    const providedKey = request.headers["x-ai-ingest-key"];
    const authenticated =
      typeof providedKey === "string" &&
      timingSafeEqual(digest(providedKey), expectedDigest);

    if (!authenticated) {
      throw new AppError({
        code: "AI_INGEST_UNAUTHENTICATED",
        message: "La clave de integracion con IA no es valida",
        statusCode: 401,
      });
    }

    request.integration = Object.freeze({ source: "ai_scraper" });
  };
}
