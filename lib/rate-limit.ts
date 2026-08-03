interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the caller can try again — 0 when allowed. */
  retryAfterSeconds: number;
}

/**
 * A simple in-memory fixed-window rate limiter. Deliberately not backed by
 * Redis/Upstash — this is a single-instance personal app, so per-process
 * memory is enough to blunt basic credential-stuffing/signup-spam attempts
 * against login and signup. Won't share state across multiple serverless
 * instances or survive a restart; that's an accepted tradeoff at this
 * app's scale, not a distributed rate limiter.
 */
export function checkRateLimit(
  key: string,
  { max, windowMs, now = Date.now() }: { max: number; windowMs: number; now?: number },
): RateLimitResult {
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (existing.count >= max) {
    return { allowed: false, retryAfterSeconds: Math.ceil((existing.resetAt - now) / 1000) };
  }

  existing.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}
