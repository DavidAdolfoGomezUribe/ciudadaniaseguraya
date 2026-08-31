import { success } from "../../../../shared/utils/response.js";
import {
  adminRefreshTokenFromCookie,
  clearAdminRefreshCookie,
  setAdminRefreshCookie,
} from "../http/admin-refresh-cookie.js";

function requestContext(request) {
  return {
    requestId: request.id,
    ipAddress: request.ip,
    userAgent: request.headers["user-agent"],
  };
}

function sessionResponse(result, config) {
  return {
    accessToken: result.session.accessToken,
    accessTokenExpiresIn: config.jwtAccessExpiresIn,
    user: result.user,
  };
}

export function createAdminAuthController({ adminAuthService, config }) {
  return Object.freeze({
    async login(request, reply) {
      const result = await adminAuthService.login(
        request.body,
        requestContext(request),
      );
      setAdminRefreshCookie(reply, result.session, config);
      return reply.send(success(request, sessionResponse(result, config)));
    },
    async refresh(request, reply) {
      const result = await adminAuthService.refresh(
        adminRefreshTokenFromCookie(request),
        requestContext(request),
      );
      setAdminRefreshCookie(reply, result.session, config);
      return reply.send(success(request, sessionResponse(result, config)));
    },
    async logout(request, reply) {
      await adminAuthService.logout(
        adminRefreshTokenFromCookie(request),
        requestContext(request),
      );
      clearAdminRefreshCookie(reply, config);
      return reply.code(204).send();
    },
    async logoutAll(request, reply) {
      await adminAuthService.logoutAll(
        request.authAdmin.id,
        requestContext(request),
      );
      clearAdminRefreshCookie(reply, config);
      return reply.code(204).send();
    },
    async me(request) {
      return success(request, await adminAuthService.me(request.authAdmin.id));
    },
  });
}
