import { headers } from "next/headers";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the caller can try again — 0 when allowed. */
  retryAfterSeconds: number;
}

const redis = Redis.fromEnv();

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
      redis,
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
  // Fails OPEN, not closed: a rate limiter is defense-in-depth, not the
  // primary gate on login/signup/etc. If Redis is unreachable (missing
  // credentials in some environment, a network blip, an Upstash outage),
  // the right failure mode is "temporarily no brute-force throttling" --
  // not "the entire app can't log anyone in." A logged, silent allow is a
  // far smaller blast radius than turning a rate-limiter hiccup into a
  // full auth outage.
  try {
    const { success, reset } = await getLimiter(max, windowMs).limit(key);
    return {
      allowed: success,
      retryAfterSeconds: success ? 0 : Math.max(0, Math.ceil((reset - Date.now()) / 1000)),
    };
  } catch (error) {
    console.error("[rate-limit] Upstash call failed, failing open:", error);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

/**
 * Best-effort client IP from the x-forwarded-for header Vercel's edge
 * network sets (first entry is the original client) -- used to rate-limit
 * login/signup by IP in addition to email, since email-only keying doesn't
 * throttle a distributed attacker trying many different accounts. Falls
 * back to a fixed placeholder when no proxy header is present (e.g. local
 * dev without a reverse proxy in front of it), which just means every
 * local request shares one IP bucket -- harmless in that environment.
 */
export async function getClientIp(): Promise<string> {
  const forwardedFor = (await headers()).get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}
