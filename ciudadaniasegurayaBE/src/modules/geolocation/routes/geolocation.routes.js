import {
  errorResponseSchema,
  successResponseSchema,
} from "../../../shared/utils/api-schemas.js";
import {
  createCellQuerySchema,
  heatmapQuerySchema,
  hexagonParamsSchema,
  hexagonQuerySchema,
} from "../validators/geolocation.schemas.js";

export async function registerGeolocationRoutes(
  app,
  { controller, defaultResolution },
) {
  app.get(
    "/api/v1/geolocation/cities",
    {
      schema: {
        tags: ["Geolocation"],
        summary: "Lista las ciudades activas",
        response: {
          200: successResponseSchema,
        },
      },
    },
    controller.cities,
  );

  app.get(
    "/api/v1/geolocation/config",
    {
      schema: {
        tags: ["Geolocation"],
        summary: "Expone la configuracion publica del mapa",
        response: {
          200: successResponseSchema,
        },
      },
    },
    controller.configuration,
  );

  app.get(
    "/api/v1/geolocation/cell",
    {
      schema: {
        tags: ["Geolocation"],
        summary: "Calcula una celda H3 para una coordenada",
        querystring: createCellQuerySchema(defaultResolution),
        response: {
          200: successResponseSchema,
          400: errorResponseSchema,
          422: errorResponseSchema,
        },
      },
    },
    controller.cell,
  );

  app.get(
    "/api/v1/geolocation/heatmap",
    {
      schema: {
        tags: ["Geolocation"],
        summary: "Consulta el mapa anual movil dentro del viewport",
        description:
          "Por defecto agrega el ultimo año hasta el instante de la consulta. " +
          "Si se envia month, conserva la consulta historica mensual.",
        querystring: heatmapQuerySchema,
        response: {
          200: successResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
          422: errorResponseSchema,
        },
      },
    },
    controller.heatmap,
  );

  app.get(
    "/api/v1/geolocation/hexagons/:h3Index",
    {
      schema: {
        tags: ["Geolocation"],
        summary: "Consulta un hexagono y sus incidentes del ultimo año",
        params: hexagonParamsSchema,
        querystring: hexagonQuerySchema,
        response: {
          200: successResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
          422: errorResponseSchema,
        },
      },
    },
    controller.hexagon,
  );
}
