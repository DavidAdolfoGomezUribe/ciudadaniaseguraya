let accessToken = null;
const listeners = new Set();

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(nextToken) {
  accessToken = nextToken || null;
  for (const listener of listeners) listener(accessToken);
}

export function clearAccessToken() {
  setAccessToken(null);
}

export function subscribeToAccessToken(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
