export const refreshCookieName = "csy_refresh";

const refreshCookiePath = "/api/v1/auth";

function baseCookieOptions(config) {
  const options = {
    path: refreshCookiePath,
    httpOnly: true,
    secure: config.refreshCookieSecure,
    sameSite: config.refreshCookieSameSite,
  };

  if (config.refreshCookieDomain) {
    options.domain = config.refreshCookieDomain;
  }

  return options;
}

export function setRefreshCookie(reply, session, config) {
  reply.setCookie(refreshCookieName, session.refreshToken, {
    ...baseCookieOptions(config),
    expires: session.refreshExpiresAt,
  });
}

export function clearRefreshCookie(reply, config) {
  reply.clearCookie(refreshCookieName, baseCookieOptions(config));
}

export function refreshTokenFromCookie(request) {
  return request.cookies[refreshCookieName];
}
