let adminAccessToken = null;
const listeners = new Set();

export function getAdminAccessToken() {
  return adminAccessToken;
}

export function setAdminAccessToken(nextToken) {
  adminAccessToken = nextToken || null;
  for (const listener of listeners) listener(adminAccessToken);
}

export function clearAdminAccessToken() {
  setAdminAccessToken(null);
}

export function subscribeToAdminAccessToken(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
