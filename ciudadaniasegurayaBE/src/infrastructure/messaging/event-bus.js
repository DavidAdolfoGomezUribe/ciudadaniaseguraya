import { randomUUID } from "node:crypto";

export function createEventBus({
  clock = () => new Date(),
  createId = randomUUID,
  historySize = 200,
} = {}) {
  const listeners = new Set();
  const history = [];

  function publish(type, data = {}) {
    const event = Object.freeze({
      id: createId(),
      type,
      occurredAt: clock().toISOString(),
      data,
    });

    history.push(event);
    if (history.length > historySize) {
      history.shift();
    }

    for (const listener of listeners) {
      try {
        listener(event);
      } catch (_error) {
        // A subscriber cannot interrupt the business operation that emitted it.
      }
    }

    return event;
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function eventsAfter(lastEventId) {
    if (!lastEventId) {
      return [];
    }

    const index = history.findIndex((event) => event.id === lastEventId);
    return index === -1 ? [] : history.slice(index + 1);
  }

  return Object.freeze({
    publish,
    subscribe,
    eventsAfter,
    listenerCount: () => listeners.size,
  });
}
