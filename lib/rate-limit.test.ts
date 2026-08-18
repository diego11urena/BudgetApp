import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// checkRateLimit's own logic is now just "map Upstash's response shape to
// ours, and cache one Ratelimit instance per distinct (max, windowMs)
// pair" -- the actual rate-limiting algorithm lives in Upstash's Redis
// service, which isn't something a fast unit suite should hit over the
// network. Mocked here so these tests exercise exactly the logic this
// file still owns, not Upstash's own (already-tested-by-Upstash) internals.
const { limitMock, ratelimitCtor, fixedWindowMock } = vi.hoisted(() => ({
  limitMock: vi.fn(),
  ratelimitCtor: vi.fn(),
  fixedWindowMock: vi.fn((tokens: number, window: string) => ({ tokens, window })),
}));

vi.mock("@upstash/redis", () => ({
  Redis: { fromEnv: () => ({}) },
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: Object.assign(
    class {
      constructor(config: unknown) {
        ratelimitCtor(config);
      }
      limit = limitMock;
    },
    { fixedWindow: fixedWindowMock },
  ),
}));

const headersGetMock = vi.fn();
vi.mock("next/headers", () => ({
  headers: async () => ({ get: headersGetMock }),
}));

const { checkRateLimit, getClientIp } = await import("./rate-limit");

describe("checkRateLimit", () => {
  beforeEach(() => {
    limitMock.mockReset();
    ratelimitCtor.mockClear();
    fixedWindowMock.mockClear();
  });

  it("maps a successful limit check to allowed:true with no retry wait", async () => {
    limitMock.mockResolvedValue({ success: true, reset: 0 });
    const result = await checkRateLimit("some-key", { max: 5, windowMs: 60_000 });
    expect(result).toEqual({ allowed: true, retryAfterSeconds: 0 });
  });

  it("maps a failed limit check to allowed:false with retryAfterSeconds from the reset time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 0, 0, 0));
    limitMock.mockResolvedValue({ success: false, reset: Date.now() + 21_000 });
    const result = await checkRateLimit("some-key", { max: 5, windowMs: 60_000 });
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBe(21);
    vi.useRealTimers();
  });

  it("never returns a negative retryAfterSeconds even if reset is already in the past", async () => {
    limitMock.mockResolvedValue({ success: false, reset: Date.now() - 5_000 });
    const result = await checkRateLimit("some-key", { max: 5, windowMs: 60_000 });
    expect(result.retryAfterSeconds).toBe(0);
  });

  // These three tests each use a (max, windowMs) pair no other test in this
  // file touches — the Ratelimit-instance cache inside rate-limit.ts is
  // module-level and outlives any one test, so reusing a pair another test
  // already hit would make these assertions depend on run order instead of
  // testing the caching logic itself.

  it("builds a fixed-window limiter matching the given max/windowMs", async () => {
    limitMock.mockResolvedValue({ success: true, reset: 0 });
    await checkRateLimit("some-key", { max: 111, windowMs: 30_000 });
    expect(fixedWindowMock).toHaveBeenCalledWith(111, "30000 ms");
  });

  it("reuses one Ratelimit instance across calls with the same (max, windowMs)", async () => {
    limitMock.mockResolvedValue({ success: true, reset: 0 });
    await checkRateLimit("key-a", { max: 222, windowMs: 60_000 });
    await checkRateLimit("key-b", { max: 222, windowMs: 60_000 });
    expect(ratelimitCtor).toHaveBeenCalledTimes(1);
  });

  it("constructs a separate Ratelimit instance for a different (max, windowMs) pair", async () => {
    limitMock.mockResolvedValue({ success: true, reset: 0 });
    await checkRateLimit("key-a", { max: 333, windowMs: 60_000 });
    await checkRateLimit("key-a", { max: 333, windowMs: 90_000 });
    expect(ratelimitCtor).toHaveBeenCalledTimes(2);
  });
});

describe("getClientIp", () => {
  afterEach(() => {
    headersGetMock.mockReset();
  });

  it("returns the first address in a comma-separated x-forwarded-for header", async () => {
    headersGetMock.mockReturnValue("203.0.113.7, 10.0.0.1");
    expect(await getClientIp()).toBe("203.0.113.7");
  });

  it("trims whitespace around the first address", async () => {
    headersGetMock.mockReturnValue(" 203.0.113.7 , 10.0.0.1");
    expect(await getClientIp()).toBe("203.0.113.7");
  });

  it("falls back to \"unknown\" when there's no x-forwarded-for header", async () => {
    headersGetMock.mockReturnValue(null);
    expect(await getClientIp()).toBe("unknown");
  });
});
