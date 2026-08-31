import { AppError } from "../../shared/errors/app-error.js";

export function createConnectionRegistry({
  maxConnections = 500,
  maxConnectionsPerClient = 3,
} = {}) {
  let total = 0;
  const byClient = new Map();

  function acquire(clientId) {
    const currentForClient = clientId ? (byClient.get(clientId) ?? 0) : 0;

    if (
      total >= maxConnections ||
      (clientId && currentForClient >= maxConnectionsPerClient)
    ) {
      throw new AppError({
        code: "SSE_CONNECTION_LIMIT",
        message: "Se alcanzo el limite de conexiones en tiempo real",
        statusCode: 429,
      });
    }

    total += 1;
    if (clientId) {
      byClient.set(clientId, currentForClient + 1);
    }

    let released = false;
    return () => {
      if (released) {
        return;
      }
      released = true;
      total = Math.max(0, total - 1);

      if (clientId) {
        const remaining = (byClient.get(clientId) ?? 1) - 1;
        if (remaining <= 0) {
          byClient.delete(clientId);
        } else {
          byClient.set(clientId, remaining);
        }
      }
    };
  }

  return Object.freeze({
    acquire,
    total: () => total,
    countForClient: (clientId) => byClient.get(clientId) ?? 0,
  });
}
