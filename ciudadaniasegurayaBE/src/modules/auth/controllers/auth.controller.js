import { success } from "../../../shared/utils/response.js";
import {
  clearRefreshCookie,
  refreshTokenFromCookie,
  setRefreshCookie,
} from "../http/refresh-cookie.js";

function sessionResponse(result, config) {
  return {
    user: result.user,
    accessToken: result.session.accessToken,
    accessTokenExpiresIn: config.jwtAccessExpiresIn,
    refreshTokenExpiresAt: result.session.refreshExpiresAt.toISOString(),
  };
}

export function createAuthController({ authService, config }) {
  return Object.freeze({
    async register(request, reply) {
      const result = await authService.register(request.body);
      setRefreshCookie(reply, result.session, config);
      return reply.code(201).send(success(request, sessionResponse(result, config)));
    },
    async login(request, reply) {
      const result = await authService.login(request.body);
      setRefreshCookie(reply, result.session, config);
      return reply.send(success(request, sessionResponse(result, config)));
    },
    async google(request, reply) {
      const result = await authService.google(request.body.credential);
      setRefreshCookie(reply, result.session, config);
      return reply.send(success(request, sessionResponse(result, config)));
    },
    async linkGoogle(request) {
      return success(
        request,
        await authService.linkGoogle(
          request.authUser.id,
          request.body.credential,
        ),
      );
    },
    async refresh(request, reply) {
      const result = await authService.refresh(refreshTokenFromCookie(request));
      setRefreshCookie(reply, result.session, config);
      return reply.send(success(request, sessionResponse(result, config)));
    },
    async logout(request, reply) {
      await authService.logout(refreshTokenFromCookie(request));
      clearRefreshCookie(reply, config);
      return reply.code(204).send();
    },
    async logoutAll(request, reply) {
      await authService.logoutAll(request.authUser.id);
      clearRefreshCookie(reply, config);
      return reply.code(204).send();
    },
    async me(request) {
      return success(request, await authService.me(request.authUser.id));
    },
  });
}
