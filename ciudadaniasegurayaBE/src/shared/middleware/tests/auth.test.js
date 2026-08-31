import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "../../../modules/admin/permissions.js";
import { registerAuthGuards } from "../auth.js";

function user(role = "admin") {
  return {
    _id: new ObjectId(),
    username: "admin_test",
    displayName: "Admin Test",
    role,
    status: "active",
  };
}

function dependencies(currentUser = user()) {
  const app = {
    decorateRequest: vi.fn(),
  };
  const usersRepository = {
    findById: vi.fn(async () => currentUser),
  };
  const adminSessionRepository = {
    findActiveSession: vi.fn(async () => ({ sessionId: "session-1" })),
  };
  const guards = registerAuthGuards(
    app,
    usersRepository,
    adminSessionRepository,
  );

  return { guards, adminSessionRepository, currentUser };
}

function request(claims) {
  return {
    authUser: null,
    authAdmin: null,
    user: null,
    async jwtVerify() {
      this.user = claims;
    },
  };
}

describe("guards administrativos", () => {
  it("rechaza un access token publico aunque pertenezca a un admin", async () => {
    const { guards, currentUser } = dependencies();
    const currentRequest = request({
      sub: currentUser._id.toHexString(),
      type: "access",
    });

    await expect(
      guards.authenticateAdmin(currentRequest),
    ).rejects.toMatchObject({
      code: "ADMIN_AUTH_REQUIRED",
      statusCode: 401,
    });
  });

  it("carga identidad, permisos y sesion administrativa viva", async () => {
    const { guards, currentUser, adminSessionRepository } = dependencies(
      user("superadmin"),
    );
    const currentRequest = request({
      sub: currentUser._id.toHexString(),
      type: "access",
      scope: "admin",
      sid: "session-1",
    });

    await guards.authenticateAdmin(currentRequest);

    expect(currentRequest.authAdmin).toMatchObject({
      id: currentUser._id,
      role: "superadmin",
      sessionId: "session-1",
    });
    expect(currentRequest.authAdmin.permissions).toContain(
      PERMISSIONS.ADMINS_PROMOTE,
    );
    expect(currentRequest.authUser).toBe(currentRequest.authAdmin);
    expect(adminSessionRepository.findActiveSession).toHaveBeenCalled();
  });

  it("requirePermission devuelve un preHandler y deniega privilegios superiores", async () => {
    const { guards, currentUser } = dependencies(user("admin"));
    const currentRequest = request({
      sub: currentUser._id.toHexString(),
      type: "access",
      scope: "admin",
      sid: "session-1",
    });
    const preHandler = guards.requirePermission(PERMISSIONS.ADMINS_PROMOTE);

    expect(preHandler).toBeTypeOf("function");
    await expect(preHandler(currentRequest)).rejects.toMatchObject({
      code: "INSUFFICIENT_ADMIN_PERMISSION",
      statusCode: 403,
    });
  });
});
