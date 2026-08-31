import { z } from "zod";

import { errorResponseSchema } from "../../shared/utils/api-schemas.js";

const streamQuerySchema = z
  .object({
    clientId: z
      .string()
      .trim()
      .min(8)
      .max(100)
      .regex(/^[A-Za-z0-9_.:-]+$/)
      .optional(),
    lastEventId: z
      .string()
      .trim()
      .min(1)
      .max(100)
      .regex(/^[A-Za-z0-9_.:-]+$/)
      .optional(),
  })
  .strict();

const streamResponse = {
  200: {
    description: "Flujo Server-Sent Events",
    content: {
      "text/event-stream": {
        schema: z.string(),
      },
    },
  },
  400: errorResponseSchema,
  401: errorResponseSchema,
  403: errorResponseSchema,
  429: errorResponseSchema,
};

export async function registerRealtimeRoutes(
  app,
  { controller, adminController, authenticateAdmin },
) {
  app.get(
    "/api/v1/events/stream",
    {
      sse: "only",
      schema: {
        tags: ["Realtime"],
        summary: "Abre el flujo de eventos en tiempo real",
        description:
          "Admite reconexion mediante Last-Event-ID o query lastEventId (el header tiene prioridad), y heartbeat automatico.",
        querystring: streamQuerySchema,
        response: streamResponse,
      },
    },
    controller.stream,
  );

  if (adminController && authenticateAdmin) {
    app.get(
      "/api/v1/admin/events/stream",
      {
        sse: "only",
        preHandler: authenticateAdmin,
        schema: {
          tags: ["Admin", "Realtime"],
          summary: "Abre el flujo protegido de eventos administrativos",
          description:
            "Requiere una sesion administrativa activa y solo emite eventos con alcance admin.",
          security: [{ bearerAuth: [] }],
          querystring: streamQuerySchema,
          response: streamResponse,
        },
      },
      adminController.stream,
    );
  }
}
