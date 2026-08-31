import {
  errorResponseSchema,
  successResponseSchema,
} from "../../../shared/utils/api-schemas.js";
import {
  hexagonStatisticsParamsSchema,
  hexagonStatisticsQuerySchema,
  statisticsHourlyQuerySchema,
  statisticsOverviewQuerySchema,
  statisticsTimeseriesQuerySchema,
  statisticsTypesQuerySchema,
} from "../validators/statistics.schemas.js";

const commonResponses = {
  200: successResponseSchema,
  400: errorResponseSchema,
  404: errorResponseSchema,
  422: errorResponseSchema,
};

export async function registerStatisticsRoutes(app, { controller }) {
  app.get(
    "/api/v1/statistics/overview",
    {
      schema: {
        tags: ["Statistics"],
        summary: "Resume los incidentes validados del periodo",
        description:
          "Cuenta solamente incidentes con validacion comunitaria o administrativa y compara con el periodo anterior.",
        querystring: statisticsOverviewQuerySchema,
        response: commonResponses,
      },
    },
    controller.overview,
  );

  app.get(
    "/api/v1/statistics/timeseries",
    {
      schema: {
        tags: ["Statistics"],
        summary: "Agrupa incidentes validados en una serie temporal",
        description:
          "Agrupa por ano, mes, dia u hora usando la zona horaria solicitada.",
        querystring: statisticsTimeseriesQuerySchema,
        response: commonResponses,
      },
    },
    controller.timeseries,
  );

  app.get(
    "/api/v1/statistics/hourly",
    {
      schema: {
        tags: ["Statistics"],
        summary: "Distribuye incidentes validados por hora del dia",
        description:
          "Devuelve las 24 horas, incluyendo horas sin registros, en la zona horaria solicitada.",
        querystring: statisticsHourlyQuerySchema,
        response: commonResponses,
      },
    },
    controller.hourly,
  );

  app.get(
    "/api/v1/statistics/types",
    {
      schema: {
        tags: ["Statistics"],
        summary: "Distribuye incidentes validados por categoria",
        description:
          "Devuelve todas las categorias publicas, incluyendo categorias sin registros.",
        querystring: statisticsTypesQuerySchema,
        response: commonResponses,
      },
    },
    controller.types,
  );

  app.get(
    "/api/v1/geolocation/hexagons/:h3Index/statistics",
    {
      schema: {
        tags: ["Geolocation", "Statistics"],
        summary: "Consulta estadisticas agregadas de un hexagono",
        description:
          "Combina resumen, serie temporal, horas y categorias para una celda H3 validada.",
        params: hexagonStatisticsParamsSchema,
        querystring: hexagonStatisticsQuerySchema,
        response: commonResponses,
      },
    },
    controller.hexagon,
  );
}
