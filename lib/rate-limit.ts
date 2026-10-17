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
// rate limiter exists.
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
): Promise<RateLimitResult> {
  if (!redis) {
    // Never configured in this environment at all. (The app's
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
    // Fail open: every remaining limiter is defense-in-depth, not the only
    // gate, so an Upstash outage shouldn't block real users.
    console.error("[rate-limit] Upstash call failed, failing open:", error);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

