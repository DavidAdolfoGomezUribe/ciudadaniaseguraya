import { describe, expect, it } from "vitest";

import { createAiIngestGuard } from "../ai-ingest-auth.js";

describe("autenticacion de ingesta con IA", () => {
  it("autentica una clave valida sin exponerla en la solicitud", async () => {
    const guard = createAiIngestGuard({ apiKey: "a".repeat(32) });
    const request = {
      headers: { "x-ai-ingest-key": "a".repeat(32) },
    };

    await guard(request);

    expect(request.integration).toEqual({ source: "ai_scraper" });
    expect(request.integration).not.toHaveProperty("apiKey");
  });

  it("rechaza una clave ausente o incorrecta", async () => {
    const guard = createAiIngestGuard({ apiKey: "a".repeat(32) });

    await expect(guard({ headers: {} })).rejects.toMatchObject({
      code: "AI_INGEST_UNAUTHENTICATED",
      statusCode: 401,
    });
    await expect(
      guard({ headers: { "x-ai-ingest-key": "incorrecta" } }),
    ).rejects.toMatchObject({
      code: "AI_INGEST_UNAUTHENTICATED",
      statusCode: 401,
    });
  });

  it("deshabilita la integracion cuando no hay clave configurada", async () => {
    const guard = createAiIngestGuard({ apiKey: "" });

    await expect(guard({ headers: {} })).rejects.toMatchObject({
      code: "AI_INGEST_DISABLED",
      statusCode: 503,
    });
  });
});
