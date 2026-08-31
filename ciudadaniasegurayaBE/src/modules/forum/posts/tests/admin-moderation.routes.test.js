import Fastify from "fastify";
import { ObjectId } from "mongodb";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setErrorHandlers } from "../../../../shared/errors/error-handler.js";
import { createPostsController } from "../controllers/posts.controller.js";
import { registerPostRoutes } from "../routes/post.routes.js";

const postId = new ObjectId().toHexString();
let app;
let service;

describe("rutas administrativas de publicaciones", () => {
  beforeEach(async () => {
    app = Fastify({ logger: false });
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    setErrorHandlers(app);
    service = {
      listAdmin: vi.fn().mockResolvedValue({ posts: [], total: 0 }),
      moderate: vi.fn().mockResolvedValue({ id: postId, status: "hidden" }),
    };
    const requireAdmin = async (request) => {
      request.authUser = {
        id: new ObjectId(),
        role: "admin",
        username: "moderador",
      };
    };
    await registerPostRoutes(app, {
      controller: createPostsController(service),
      authenticate: requireAdmin,
      requireAdmin,
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("pagina y ordena el listado desde backend", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/admin/posts?search=alerta&status=active",
    });

    expect(response.statusCode).toBe(200);
    expect(service.listAdmin).toHaveBeenCalledWith(
      expect.objectContaining({
        page: 1,
        pageSize: 25,
        search: "alerta",
        status: "active",
        sortBy: "createdAt",
        sortOrder: "desc",
      }),
    );
  });

  it("exige motivo para ocultar una publicacion", async () => {
    const invalid = await app.inject({
      method: "POST",
      url: `/api/v1/admin/posts/${postId}/hide`,
      payload: {},
    });
    const valid = await app.inject({
      method: "POST",
      url: `/api/v1/admin/posts/${postId}/hide`,
      payload: {
        reason: "La publicacion expone informacion personal sensible.",
      },
    });

    expect(invalid.statusCode).toBe(400);
    expect(valid.statusCode).toBe(200);
    expect(service.moderate).toHaveBeenCalledWith(
      postId,
      "hidden",
      expect.objectContaining({ role: "admin" }),
      "La publicacion expone informacion personal sensible.",
      expect.any(String),
    );
  });
});
