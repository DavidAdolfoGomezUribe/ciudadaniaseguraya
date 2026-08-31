import {
  ADMIN_ROLES,
  ROLES,
  assertKnownPermission,
  hasPermission,
  permissionsForRole,
} from "../../modules/admin/permissions.js";
import { AppError } from "../errors/app-error.js";

function unauthenticated() {
  return new AppError({
    code: "UNAUTHENTICATED",
    message: "La sesion no es valida",
    statusCode: 401,
  });
}

function adminAuthenticationRequired() {
  return new AppError({
    code: "ADMIN_AUTH_REQUIRED",
    message: "Se requiere una sesion administrativa.",
    statusCode: 401,
  });
}

function suspended() {
  return new AppError({
    code: "ACCOUNT_SUSPENDED",
    message: "La cuenta esta suspendida",
    statusCode: 403,
  });
}

function insufficientAdminPermission() {
  return new AppError({
    code: "INSUFFICIENT_ADMIN_PERMISSION",
    message: "No tienes permisos para realizar esta accion administrativa.",
    statusCode: 403,
  });
}

export function registerAuthGuards(
  app,
  usersRepository,
  adminSessionRepository,
) {
  app.decorateRequest("authUser", null);
  app.decorateRequest("authAdmin", null);

  async function verifiedClaims(request) {
    await request.jwtVerify();
    if (request.user.type !== "access" || !request.user.sub) {
      throw unauthenticated();
    }
    return request.user;
  }

  async function activeUser(userId, adminContext = false) {
    const user = await usersRepository.findById(userId);
    if (!user || user.status === "deleted") {
      throw adminContext ? adminAuthenticationRequired() : unauthenticated();
    }
    if (user.status === "suspended") {
      throw suspended();
    }
    return user;
  }

  function userIdentity(user) {
    return {
      id: user._id,
      role: user.role,
      status: user.status,
      username: user.username,
      displayName: user.displayName ?? user.username,
    };
  }

  async function authenticate(request) {
    if (request.authUser) {
      return;
    }

    const claims = await verifiedClaims(request);
    const user = await activeUser(claims.sub);

    if (claims.scope === "admin") {
      if (
        !claims.sid ||
        !ADMIN_ROLES.includes(user.role) ||
        !adminSessionRepository ||
        !(await adminSessionRepository.findActiveSession(
          claims.sid,
          user._id,
          new Date(),
        ))
      ) {
        throw adminAuthenticationRequired();
      }
    }

    request.authUser = userIdentity(user);
  }

  async function authenticateAdmin(request) {
    if (request.authAdmin) {
      return;
    }

    const claims = await verifiedClaims(request);
    if (claims.scope !== "admin" || !claims.sid) {
      throw adminAuthenticationRequired();
    }

    const user = await activeUser(claims.sub, true);
    if (!ADMIN_ROLES.includes(user.role)) {
      throw insufficientAdminPermission();
    }

    const activeSession = await adminSessionRepository?.findActiveSession(
      claims.sid,
      user._id,
      new Date(),
    );
    if (!activeSession) {
      throw adminAuthenticationRequired();
    }

    const identity = {
      ...userIdentity(user),
      permissions: permissionsForRole(user.role),
      sessionId: claims.sid,
    };
    request.authAdmin = identity;
    request.authUser = identity;
  }

  function requirePermission(permission) {
    assertKnownPermission(permission);
    return async function permissionPreHandler(request) {
      await authenticateAdmin(request);
      if (!hasPermission(request.authAdmin.role, permission)) {
        throw insufficientAdminPermission();
      }
    };
  }

  async function requireAdminRole(request) {
    await authenticateAdmin(request);
  }

  async function requireSuperadmin(request) {
    await authenticateAdmin(request);
    if (request.authAdmin.role !== ROLES.SUPERADMIN) {
      throw insufficientAdminPermission();
    }
  }

  return Object.freeze({
    authenticate,
    authenticateAdmin,
    requirePermission,
    requireAdminRole,
    requireSuperadmin,
    requireAdmin: requireAdminRole,
  });
}
