import { describe, expect, it } from "vitest";
import { checkRateLimit } from "./rate-limit";

describe("checkRateLimit", () => {
  it("allows attempts up to the max within the window", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, { max: 5, windowMs: 60_000, now: 0 }).allowed).toBe(true);
    }
  });

  it("blocks the attempt after the max is reached within the window", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, { max: 5, windowMs: 60_000, now: 0 });
    }
    const result = checkRateLimit(key, { max: 5, windowMs: 60_000, now: 0 });
    expect(result.allowed).toBe(false);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("reports retryAfterSeconds as time remaining until the window resets", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 3; i++) {
      checkRateLimit(key, { max: 3, windowMs: 30_000, now: 1_000 });
    }
    const result = checkRateLimit(key, { max: 3, windowMs: 30_000, now: 10_000 });
    expect(result.allowed).toBe(false);
    // Window opened at now=1000, resets at 1000+30000=31000; at now=10000, 21000ms left.
    expect(result.retryAfterSeconds).toBe(21);
  });

  it("resets the count once the window has passed", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      checkRateLimit(key, { max: 5, windowMs: 1_000, now: 0 });
    }
    expect(checkRateLimit(key, { max: 5, windowMs: 1_000, now: 0 }).allowed).toBe(false);
    // Past the window entirely.
    expect(checkRateLimit(key, { max: 5, windowMs: 1_000, now: 1_500 }).allowed).toBe(true);
  });

  it("tracks separate keys independently", () => {
    const keyA = `test-a-${Math.random()}`;
    const keyB = `test-b-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      checkRateLimit(keyA, { max: 5, windowMs: 60_000, now: 0 });
    }
    expect(checkRateLimit(keyA, { max: 5, windowMs: 60_000, now: 0 }).allowed).toBe(false);
    expect(checkRateLimit(keyB, { max: 5, windowMs: 60_000, now: 0 }).allowed).toBe(true);
  });
});
