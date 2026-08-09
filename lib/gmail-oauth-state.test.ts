import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { signGmailOAuthState, verifyGmailOAuthState } from "./gmail-oauth-state";

beforeEach(() => {
  process.env.AUTH_SECRET = "test-secret-value";
});

afterEach(() => {
  vi.useRealTimers();
});

describe("signGmailOAuthState / verifyGmailOAuthState", () => {
  it("round-trips: verifying a freshly signed state returns the same userId", () => {
    const state = signGmailOAuthState("user-123");
    expect(verifyGmailOAuthState(state)).toBe("user-123");
  });

  it("rejects a state signed with a different secret", () => {
    const state = signGmailOAuthState("user-123");
    process.env.AUTH_SECRET = "a-different-secret";
    expect(verifyGmailOAuthState(state)).toBeNull();
  });

  it("rejects a tampered payload (userId swapped after signing)", () => {
    const state = signGmailOAuthState("user-123");
    const [, signature] = state.split(".");
    const forgedPayload = Buffer.from("someone-elses-id:" + Date.now(), "utf-8").toString("base64url");
    expect(verifyGmailOAuthState(`${forgedPayload}.${signature}`)).toBeNull();
  });

  it("rejects a malformed state string", () => {
    expect(verifyGmailOAuthState("not-a-valid-state")).toBeNull();
    expect(verifyGmailOAuthState("")).toBeNull();
  });

  it("rejects an expired state (older than the TTL)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const state = signGmailOAuthState("user-123");

    vi.setSystemTime(new Date("2026-01-01T00:11:00Z")); // 11 minutes later
    expect(verifyGmailOAuthState(state)).toBeNull();
  });

  it("accepts a state just under the TTL", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const state = signGmailOAuthState("user-123");

    vi.setSystemTime(new Date("2026-01-01T00:09:00Z")); // 9 minutes later
    expect(verifyGmailOAuthState(state)).toBe("user-123");
  });
});
