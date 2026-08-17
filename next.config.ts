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
        ],
      },
    ];
  },
};

export default nextConfig;
