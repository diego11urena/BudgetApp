import type { NextConfig } from "next";

// Everything this app actually loads in the browser is same-origin: fonts
// are self-hosted at build time by next/font (no fonts.googleapis.com/
// fonts.gstatic.com fetch ever happens client-side), there's no analytics/
// third-party script, and the one cross-origin trip (Gmail OAuth) is a
// full top-level navigation via a plain <a href> -> server redirect, not
// an XHR/fetch -- so it's outside connect-src's reach and doesn't need an
// entry here. 'unsafe-inline' on style-src is required because this app's
// components lean heavily on React's style={{...}} prop (inline style
// attributes), not because of any <style> tag; script-src needs it for
// Next's own hydration payload, since this app doesn't thread a per-request
// nonce through middleware -- still meaningfully restrictive: it blocks
// loading a script from any *external* origin, which is how most real-world
// XSS payloads exfiltrate data, and this app has zero dangerouslySetInnerHTML
// usage (confirmed via audit) so inline-script injection isn't a live path
// to begin with.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "upgrade-insecure-requests",
].join("; ");

/**
 * `next dev` against the production database is a real incident this repo
 * has already had: `vercel env pull` writes production credentials into
 * `.env.local`, and Next loads `.env.local` at HIGHER precedence than
 * `.env`. So a developer who set `.env` to localhost still gets
 * production, with nothing in the output saying so -- and `npm run dev`
 * is how you click around signing up users and closing cycles.
 *
 * The E2E suite already refuses to start in that situation
 * (tests/e2e/global-setup.ts). This is the same guard for the dev server,
 * which had none. A warning rather than a throw, deliberately: pointing
 * dev at a remote database is occasionally legitimate (debugging a
 * staging dataset), so this makes it impossible to do BY ACCIDENT without
 * making it impossible to do on purpose.
 *
 * Fix, when it fires: put the local DATABASE_URL in
 * `.env.development.local`, which outranks `.env.local` for `next dev`.
 */
const LOCAL_DB_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0", "host.docker.internal", "postgres", "db"]);

function warnIfDevPointsAtRemoteDatabase(): void {
  if (process.env.NODE_ENV !== "development") return;
  const raw = process.env.DATABASE_URL;
  if (!raw) return;

  let host: string;
  try {
    host = new URL(raw).hostname;
  } catch {
    return;
  }
  if (LOCAL_DB_HOSTS.has(host)) return;

  console.warn(
    [
      "",
      "  \x1b[41m\x1b[97m  WARNING  \x1b[0m  next dev is pointed at a NON-LOCAL database",
      "",
      `  host: ${host}`,
      "",
      "  Anything you click in the browser -- signing up, logging a",
      "  transaction, closing a cycle -- writes to that database.",
      "",
      "  If that isn't what you want, put your local DATABASE_URL in",
      "  .env.development.local (it outranks .env.local for next dev).",
      "",
    ].join("\n"),
  );
}

warnIfDevPointsAtRemoteDatabase();

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // This app never uses the camera, mic, geolocation, or the
          // Payment Request API -- deny all of them outright rather than
          // leaving them at the (permissive) browser default.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
