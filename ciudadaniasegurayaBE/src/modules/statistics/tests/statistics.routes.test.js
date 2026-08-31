import Fastify from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createStatisticsController } from "../controllers/statistics.controller.js";
import { registerStatisticsRoutes } from "../routes/statistics.routes.js";
import { setErrorHandlers } from "../../../shared/errors/error-handler.js";

const h3Index = "8966e42888fffff";
let app;
let service;

describe("rutas de estadisticas", () => {
  beforeEach(async () => {
    app = Fastify({ logger: false });
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    setErrorHandlers(app);
    service = {
      overview: vi.fn(async (input) => input),
      timeseries: vi.fn(async (input) => input),
      hourly: vi.fn(async (input) => input),
      types: vi.fn(async (input) => input),
      hexagon: vi.fn(async (input) => input),
    };
    await registerStatisticsRoutes(app, {
      controller: createStatisticsController(service),
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it.each([
    ["overview", "overview"],
    ["timeseries", "timeseries"],
    ["hourly", "hourly"],
    ["types", "types"],
  ])("expone GET /statistics/%s", async (path, method) => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/statistics/${path}`,
    });

    expect(response.statusCode).toBe(200);
    expect(service[method]).toHaveBeenCalledOnce();
    expect(response.json()).toMatchObject({ success: true });
    if (method === "timeseries") {
      expect(response.json().data).toEqual({ groupBy: "month" });
    }
  });

  it("expone la agregacion completa por hexagono", async () => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v1/geolocation/hexagons/${h3Index}/statistics?groupBy=day`,
    });

    expect(response.statusCode).toBe(200);
    expect(service.hexagon).toHaveBeenCalledWith({
      h3Index,
      groupBy: "day",
    });
  });

  it("rechaza filtros fuera del contrato", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/statistics/overview?status=pending",
    });

    expect(response.statusCode).toBe(400);
    expect(service.overview).not.toHaveBeenCalled();
  });
});
