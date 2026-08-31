export const adminRefreshCookieName = "csy_admin_refresh";

const adminRefreshCookiePath = "/api/v1/admin/auth";

function baseCookieOptions(config) {
  const options = {
    path: adminRefreshCookiePath,
    httpOnly: true,
    secure: config.refreshCookieSecure,
    sameSite: config.refreshCookieSameSite,
  };

  if (config.refreshCookieDomain) {
    options.domain = config.refreshCookieDomain;
  }

  return options;
}

export function setAdminRefreshCookie(reply, session, config) {
  reply.setCookie(adminRefreshCookieName, session.refreshToken, {
    ...baseCookieOptions(config),
    expires: session.refreshExpiresAt,
  });
}

export function clearAdminRefreshCookie(reply, config) {
  reply.clearCookie(adminRefreshCookieName, baseCookieOptions(config));
}

export function adminRefreshTokenFromCookie(request) {
  return request.cookies[adminRefreshCookieName];
}
