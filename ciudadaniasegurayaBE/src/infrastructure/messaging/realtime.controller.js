import { randomUUID } from "node:crypto";

function sseMessage(event) {
  return {
    id: event.id,
    event: event.type,
    data: event,
  };
}

export function createRealtimeController({
  eventBus,
  connectionRegistry,
  clock = () => new Date(),
  createId = randomUUID,
  acceptsEvent = () => true,
  connectedEventType = "system.connected",
  revalidateConnection = null,
  connectionExpiresAt = () => null,
  validationIntervalMs = 30_000,
}) {
  return Object.freeze({
    async stream(request, reply) {
      const release = connectionRegistry.acquire(request.query.clientId);
      let unsubscribe = () => {};
      let sendQueue = Promise.resolve();
      let closed = false;
      let expirationTimer = null;
      let validationTimer = null;
      let validationInFlight = null;

      const cleanup = () => {
        if (closed) {
          return;
        }
        closed = true;
        if (expirationTimer) clearTimeout(expirationTimer);
        if (validationTimer) clearInterval(validationTimer);
        unsubscribe();
        release();
      };

      const closeConnection = () => {
        if (!closed) {
          reply.sse.close();
          cleanup();
        }
      };

      const validateConnection = async () => {
        if (closed) return false;
        if (!revalidateConnection) return true;
        if (!validationInFlight) {
          validationInFlight = Promise.resolve(revalidateConnection(request))
            .then((valid) => {
              if (!valid) closeConnection();
              return valid;
            })
            .catch(() => {
              closeConnection();
              return false;
            })
            .finally(() => {
              validationInFlight = null;
            });
        }
        return validationInFlight;
      };

      reply.sse.keepAlive();
      reply.sse.onClose(cleanup);

      const expiresAt = connectionExpiresAt(request);
      if (Number.isFinite(expiresAt)) {
        const remainingMs = expiresAt - Date.now();
        if (remainingMs <= 0) {
          closeConnection();
          return;
        }
        expirationTimer = setTimeout(closeConnection, remainingMs);
        expirationTimer.unref?.();
      }
      if (revalidateConnection && validationIntervalMs > 0) {
        validationTimer = setInterval(() => {
          void validateConnection();
        }, validationIntervalMs);
        validationTimer.unref?.();
      }

      const lastEventId =
        reply.sse.lastEventId ?? request.query.lastEventId;
      if (lastEventId) {
        for (const event of eventBus.eventsAfter(lastEventId)) {
          if (acceptsEvent(event)) {
            const valid = await validateConnection();
            if (!valid || closed) {
              break;
            }
            await reply.sse.send(sseMessage(event));
          }
        }
      }

      if (closed) {
        return;
      }

      unsubscribe = eventBus.subscribe((event) => {
        if (!acceptsEvent(event)) {
          return;
        }
        sendQueue = sendQueue
          .then(async () => {
            const valid = await validateConnection();
            if (valid && !closed) {
              await reply.sse.send(sseMessage(event));
            }
          })
          .catch(() => {
            closeConnection();
          });
      });

      const connectedEventId = createId();
      await reply.sse.send({
        id: connectedEventId,
        event: connectedEventType,
        retry: 3_000,
        data: {
          id: connectedEventId,
          type: connectedEventType,
          occurredAt: clock().toISOString(),
          data: {},
        },
      });
    },
  });
}
