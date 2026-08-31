import { z } from "zod";

export const agentRunBodySchema = z
  .object({
    provider: z.enum(["openai", "ollama"]),
    model: z.string().trim().min(1).max(200),
    limit: z.coerce.number().int().min(1).max(100),
    maxArticles: z.coerce.number().int().min(1).max(100).default(100),
    ingest: z.boolean().default(false),
    confirmIngest: z.boolean().default(false),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.ingest && !value.confirmIngest) {
      context.addIssue({
        code: "custom",
        path: ["confirmIngest"],
        message: "Debes confirmar el envio de incidentes al backend",
      });
    }
    if (value.maxArticles < value.limit) {
      context.addIssue({
        code: "custom",
        path: ["maxArticles"],
        message: "El maximo a revisar debe cubrir el objetivo de validos",
      });
    }
  });

export const agentRunParamsSchema = z
  .object({
    runId: z.string().regex(/^[0-9a-f]{32}$/i),
  })
  .strict();
