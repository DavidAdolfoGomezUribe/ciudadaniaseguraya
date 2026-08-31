import { z } from "zod";

export const requestMetaSchema = z.object({
  requestId: z.string(),
});

export const successResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.unknown(),
    meta: requestMetaSchema,
  })
  .describe("Respuesta exitosa")
  .meta({
    examples: [
      {
        success: true,
        data: {},
        meta: { requestId: "req-1" },
      },
    ],
  });

export const paginatedResponseSchema = z
  .object({
    success: z.literal(true),
    data: z.array(z.unknown()),
    meta: requestMetaSchema.extend({
      page: z.number().int().positive(),
      pageSize: z.number().int().positive(),
      total: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
    }),
  })
  .describe("Respuesta paginada")
  .meta({
    examples: [
      {
        success: true,
        data: [],
        meta: {
          page: 1,
          pageSize: 20,
          total: 0,
          totalPages: 0,
          requestId: "req-1",
        },
      },
    ],
  });

export const errorResponseSchema = z
  .object({
    success: z.literal(false),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.array(z.unknown()),
    }),
    meta: requestMetaSchema,
  })
  .describe("Respuesta de error")
  .meta({
    examples: [
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Los datos enviados no son validos",
          details: [],
        },
        meta: { requestId: "req-1" },
      },
    ],
  });

export const emptyResponseSchema = z
  .undefined()
  .describe("Operacion completada sin contenido");
