import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";

import { clearAccessToken } from "@/features/auth/state/access-token-vault";
import { clearAdminAccessToken } from "@/features/admin/auth/state/admin-access-token-vault";
import { useAdminRealtimeStore } from "@/features/admin/realtime/state/admin-realtime.store";

import { server } from "./mocks/server";

beforeAll(() => {
  server.listen({ onUnhandledRequest: "error" });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  clearAccessToken();
  clearAdminAccessToken();
  useAdminRealtimeStore.setState({
    status: "connecting",
    notifications: [],
    lastEventId: null,
  });
  window.localStorage.clear();
  window.sessionStorage.clear();
  document.documentElement.dataset.theme = "light";
  document.documentElement.style.colorScheme = "";
});

afterAll(() => {
  server.close();
});

if (!window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false;
      },
    }),
  });
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}

    unobserve() {}

    disconnect() {}
  };
}
