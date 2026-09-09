/**
 * Refuses to run the E2E suite against anything but a local database.
 *
 * Every spec here signs up a real user, logs real transactions and closes
 * real budget cycles — against production that's not a test run, it's
 * writing garbage into live accounts. That happened once: `vercel env
 * pull` wrote production credentials into `.env.local`, Next.js loads
 * `.env.local` at HIGHER precedence than `.env`, and so `next dev` — and
 * every `npm run test:e2e` reusing it — silently pointed at production
 * while the Prisma CLI (prisma.config.ts reads only `.env`) stayed on
 * localhost. Nothing in the setup disagreed loudly enough to notice.
 *
 * So this asserts it, before a single spec runs. A wrong DATABASE_URL is
 * now a one-line failure instead of 126 junk accounts in production.
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0", "host.docker.internal", "postgres", "db"]);

export default function globalSetup(): void {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error(
      "E2E: DATABASE_URL is not set.\n" +
        "playwright.config.ts is supposed to load it from .env (the local database) — " +
        "if you're seeing this, that load failed.",
    );
  }

  let host: string;
  try {
    host = new URL(raw).hostname;
  } catch {
    throw new Error("E2E: DATABASE_URL is not a parseable URL, so its host can't be verified. Refusing to run.");
  }

  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `E2E: refusing to run against a non-local database (host: ${host}).\n\n` +
        "This suite creates users, logs transactions and closes budget cycles. Pointed at a\n" +
        "real database, it writes junk into live accounts — which is exactly what happened\n" +
        "when .env.local (production, via `vercel env pull`) shadowed .env (localhost).\n\n" +
        "Fix: make sure .env's DATABASE_URL points at your local Postgres, and that no\n" +
        "already-running `next dev` on port 3000 is holding a production connection.\n" +
        `Expected one of: ${[...LOCAL_HOSTS].join(", ")}`,
    );
  }

  console.log(`E2E: database host verified local (${host}).`);
}

