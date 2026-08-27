import { headers } from "next/headers";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the caller can try again — 0 when allowed. */
  retryAfterSeconds: number;
}

// Deliberately not eagerly Redis.fromEnv() at module scope -- an
// environment that never configured Upstash at all (this repo's own CI,
// which has no Upstash secrets wired up; a self-hosted deploy that
// opts out) is a different situation from one that configured it and
// is having a transient outage, and the two need different handling
// (see checkRateLimit below): "not configured" always behaves as if no
// rate limiter exists, regardless of failClosed, since there was never
// a limiter here to fail-anything.
const isConfigured = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const redis = isConfigured ? Redis.fromEnv() : null;

/**
 * A Redis-backed fixed-window rate limiter, shared across every serverless
 * instance Vercel runs (unlike an in-memory Map, which only sees requests
 * that happen to land on the same process, and forgets everything on every
 * redeploy). Each distinct (max, windowMs) pair used across the app's call
 * sites needs its own Ratelimit instance -- constructing one does no I/O,
 * so caching them by that pair just avoids rebuilding one on every call.
 */
const limiters = new Map<string, Ratelimit>();

function getLimiter(max: number, windowMs: number): Ratelimit {
  const cacheKey = `${max}:${windowMs}`;
  let limiter = limiters.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: redis!,
      // Fixed window, not sliding -- matches this limiter's original
      // in-memory semantics (see git history), rather than silently
      // becoming stricter or more lenient by switching algorithms.
      limiter: Ratelimit.fixedWindow(max, `${windowMs} ms`),
      analytics: false,
      prefix: "budgetapp-ratelimit",
    });
    limiters.set(cacheKey, limiter);
  }
  return limiter;
}

export async function checkRateLimit(
  key: string,
  { max, windowMs }: { max: number; windowMs: number },
  options?: {
    /**
     * Login/signup/change-password are the only anti-brute-force control
     * this app has (no account lockout, no progressive delay, no CAPTCHA;
     * bcrypt itself has no throttle) — for exactly those, an Upstash
     * hiccup must fail CLOSED, or an attacker who first burns through the
     * free-tier command quota gets an unthrottled credential-stuffing
     * window against 8-character-minimum passwords. Everywhere else
     * (Gmail's routes, etc.) keeps the original fail-OPEN default: those
     * limiters are defense-in-depth, not the only gate, and a temporary
     * outage there is a smaller blast radius than blocking a real user.
     */
    failClosed?: boolean;
  },
): Promise<RateLimitResult> {
  if (!redis) {
    // Never configured in this environment at all -- not a failure of a
    // limiter that exists, so this ignores failClosed entirely. (The app's
    // own CI has no Upstash secrets wired up; local dev normally does,
    // via .env, per .env.example.)
    return { allowed: true, retryAfterSeconds: 0 };
  }
  try {
    const { success, reset } = await getLimiter(max, windowMs).limit(key);
    return {
      allowed: success,
      retryAfterSeconds: success ? 0 : Math.max(0, Math.ceil((reset - Date.now()) / 1000)),
    };
  } catch (error) {
    const mode = options?.failClosed ? "closed" : "open";
    console.error(`[rate-limit] Upstash call failed, failing ${mode}:`, error);
    if (options?.failClosed) {
      return { allowed: false, retryAfterSeconds: 60 };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

/**
 * Best-effort client IP -- used to rate-limit login/signup by IP in
 * addition to email, since email-only keying doesn't throttle a
 * distributed attacker trying many different accounts. Prefers
 * x-vercel-forwarded-for / x-real-ip, which Vercel's edge network sets
 * and guarantees aren't attacker-controlled (it overwrites, not appends,
 * these specifically), over the plain x-forwarded-for -- Vercel documents
 * that IT overwrites x-forwarded-for too, but that guarantee is about
 * Vercel's own proxy layer specifically, and taking [0] from a
 * comma-separated list is the classically spoofable position if any
 * intermediate hop ever *appends* instead. Falls back to a fixed
 * placeholder when none of these are present (e.g. local dev with no
 * reverse proxy in front of it), which just means every local request
 * shares one IP bucket -- harmless in that environment.
 */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip")?.trim() ||
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
