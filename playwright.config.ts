import { defineConfig, devices } from "@playwright/test";

/**
 * E2E suite for the core money-moving flows (add/edit/delete a
 * transaction, close a quincena, merge categories, contribute to a goal).
 * Runs against a real Next.js server + real Postgres database — each spec
 * signs up its own fresh user (unique email per run) rather than sharing
 * fixtures, so tests can run in parallel without state collisions and
 * never depend on what a previous run left behind.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    viewport: { width: 390, height: 844 }, // this app's primary target: an iPhone-width PWA
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  // Starts its own server unless one's already running locally (so `npm
  // run test:e2e` during development can reuse an existing `npm run dev`
  // without a port clash) — CI always starts fresh, and against a real
  // production build rather than the dev server: a route's first-ever
  // Turbopack compile under `next dev` can take several seconds, which
  // reads as flakiness in a test suite rather than the one-time dev-mode
  // cost it actually is.
  webServer: {
    command: process.env.CI ? "npm run build && npm run start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
