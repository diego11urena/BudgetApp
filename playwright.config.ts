import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

// Explicitly `.env` — NOT Next.js's normal cascade, which puts `.env.local`
// on top. `.env.local` holds production credentials here (written by
// `vercel env pull`), and this suite must never touch that database: it
// signs up users, logs transactions and closes budget cycles for real.
// Loading the local database URL here also means the DATABASE_URL that
// tests/e2e/seed-transaction.ts inherits (spawned as a bare `npx tsx`
// subprocess, which gets no env of its own) is the same one the server
// under test is using — they silently disagreed before, and the seed just
// failed with "record not found" because it was querying a different
// database than the one the browser had just signed up against.
// dotenv never overwrites an already-set variable, so an explicit
// DATABASE_URL in your shell still wins; global-setup.ts checks whatever
// ends up resolved either way.
loadEnv({ path: ".env" });

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
  // Hard stop before any spec runs if DATABASE_URL isn't local — see that
  // file for the incident this exists to prevent.
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // GitHub's standard runner (4 vCPU) has the production Next.js server,
  // the Postgres service container, AND every worker's own Chromium all
  // competing for the same handful of cores — Playwright's default worker
  // count (scales with detected CPUs) overcommits it once the suite has
  // enough specs, and the symptom isn't a handful of slow tests, it's
  // requests starved long enough to blow the whole 60s test timeout.
  // Local runs are capped to the same 2 now, for the same reason. They used
  // to piggyback on an already-warm `npm run dev`, which absorbed the
  // compile cost; now that the suite always starts its own server (see
  // webServer below), a cold `next dev` compiles routes on demand WHILE
  // four workers hammer it, and signup starts blowing its 60s timeout
  // waiting to be served. Warming the routes up front doesn't help --
  // unauthenticated requests redirect at middleware without ever building
  // the real route. Fewer workers does.
  workers: 2,
  reporter: process.env.CI ? "github" : "list",
  // A bit more slack in CI specifically, on top of the worker cap above —
  // belt and suspenders against the same contention, not a substitute for
  // fixing it.
  timeout: process.env.CI ? 90_000 : 60_000,
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
  // Always starts its own server, never reuses one already on :3000.
  // Reuse used to be allowed locally (so `npm run test:e2e` could piggyback
  // on a running `npm run dev`), but a reused server brings its OWN
  // environment — including a DATABASE_URL this config has no say over.
  // That's the exact hole production data leaked through: a `next dev`
  // holding `.env.local`'s production connection, quietly reused by the
  // test suite. Starting fresh with an explicit env is the only way this
  // config can actually guarantee which database gets written to. The cost
  // is a port clash if a dev server is already up — a loud, immediate
  // failure, which is the point.
  //
  // CI additionally runs against a real production build rather than the
  // dev server: a route's first-ever Turbopack compile under `next dev` can
  // take several seconds, which reads as flakiness in a test suite rather
  // than the one-time dev-mode cost it actually is.
  webServer: {
    command: process.env.CI ? "npm run build && npm run start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    timeout: 180_000,
    // Next.js's own env loading does not overwrite variables already
    // present in the environment, so this pins the server to the same
    // local database global-setup.ts just verified, regardless of what
    // `.env.local` says.
    env: { DATABASE_URL: process.env.DATABASE_URL ?? "" },
  },
});
