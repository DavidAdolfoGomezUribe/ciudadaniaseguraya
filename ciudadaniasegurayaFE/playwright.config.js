import { defineConfig, devices } from "@playwright/test";

const e2eBaseUrl = process.env.CSY_E2E_BASE_URL || "http://127.0.0.1:3100";
const skipWebServer = process.env.CSY_E2E_SKIP_WEBSERVER === "true";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL: e2eBaseUrl,
    trace: "on-first-retry",
  },
  ...(skipWebServer
    ? {}
    : {
        webServer: {
          command: "pnpm dev --hostname 127.0.0.1 --port 3100",
          url: e2eBaseUrl,
          reuseExistingServer: process.env.CSY_E2E_REUSE_EXISTING === "true",
          timeout: 120_000,
        },
      }),
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
