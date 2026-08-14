import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatCycleLabel, hourInPanama, nowInPanama, parsePayDate, parseTransactionDate } from "./pay-date";

// Regression anchor for the "server computes 'today' in UTC, not Panama
// time" bug: Vercel's serverless functions run in UTC, and Panama is
// UTC-5 year-round (no DST), so the server's own clock reads a calendar
// day ahead of Panama for the ~5 hours between Panama's 7pm and midnight
// (UTC has already rolled to the next day; Panama hasn't). These pin
// nowInPanama()/hourInPanama() against the system clock across exactly
// that boundary, using vi.setSystemTime rather than a live "now" so the
// test doesn't depend on what time it happens to be when it runs.
describe("nowInPanama / hourInPanama", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("still reads Panama's earlier calendar day when UTC has already rolled to the next one", () => {
    // 2026-08-15 02:00 UTC = 2026-08-14 21:00 in Panama (UTC-5) -- the
    // exact window the bug affects.
    vi.setSystemTime(new Date("2026-08-15T02:00:00.000Z"));
    expect(nowInPanama()).toEqual(new Date(2026, 7, 14));
    expect(hourInPanama()).toBe(21);
  });

  it("agrees with the server's own UTC day once Panama has also rolled over", () => {
    // 2026-08-15 06:00 UTC = 2026-08-15 01:00 in Panama -- both sides now
    // agree it's the 15th.
    vi.setSystemTime(new Date("2026-08-15T06:00:00.000Z"));
    expect(nowInPanama()).toEqual(new Date(2026, 7, 15));
    expect(hourInPanama()).toBe(1);
  });
});

describe("formatCycleLabel", () => {
  it("formats as zero-padded YYYY-MM-DD", () => {
    expect(formatCycleLabel(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("pads single-digit months and days", () => {
    expect(formatCycleLabel(new Date(2026, 8, 2))).toBe("2026-09-02");
  });

  it("does not pad a 4-digit year further and handles double-digit month/day", () => {
    expect(formatCycleLabel(new Date(2026, 11, 25))).toBe("2026-12-25");
  });

  it("defaults to the current date when called with no argument", () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    expect(formatCycleLabel()).toBe(expected);
  });
});

describe("parsePayDate", () => {
  const now = new Date(2026, 7, 15); // Aug 15, 2026

  it("parses a well-formed date within range", () => {
    const result = parsePayDate("2026-08-12", now);
    expect(result).toEqual(new Date(2026, 7, 12));
  });

  it("accepts today itself", () => {
    expect(parsePayDate("2026-08-15", now)).toEqual(new Date(2026, 7, 15));
  });

  it("accepts exactly the lookback boundary (7 days back)", () => {
    expect(parsePayDate("2026-08-08", now)).toEqual(new Date(2026, 7, 8));
  });

  it("rejects a date further back than the lookback window", () => {
    expect(parsePayDate("2026-08-07", now)).toBeNull();
  });

  it("rejects a future date", () => {
    expect(parsePayDate("2026-08-16", now)).toBeNull();
  });

  it("rejects a malformed string", () => {
    expect(parsePayDate("not-a-date", now)).toBeNull();
    expect(parsePayDate("08/12/2026", now)).toBeNull();
    expect(parsePayDate("", now)).toBeNull();
  });

  it("rejects a calendar-invalid date instead of letting it roll over", () => {
    // Feb 30 doesn't exist; JS's Date would silently normalize it to Mar 2,
    // which (with "now" set here) would otherwise pass the range check —
    // isolating that this is caught by the rollover guard, not the range one.
    const marchNow = new Date(2026, 2, 5); // Mar 5, 2026
    expect(parsePayDate("2026-02-30", marchNow)).toBeNull();
  });
});

describe("parseTransactionDate", () => {
  const now = new Date(2026, 7, 15); // Aug 15, 2026
  const cycleStart = new Date(2026, 7, 1); // Aug 1, 2026

  it("parses a date within the cycle", () => {
    expect(parseTransactionDate("2026-08-10", cycleStart, now)).toEqual(new Date(2026, 7, 10));
  });

  it("accepts today itself", () => {
    expect(parseTransactionDate("2026-08-15", cycleStart, now)).toEqual(new Date(2026, 7, 15));
  });

  it("accepts exactly the cycle's start date", () => {
    expect(parseTransactionDate("2026-08-01", cycleStart, now)).toEqual(new Date(2026, 7, 1));
  });

  it("rejects a date before the cycle started", () => {
    expect(parseTransactionDate("2026-07-31", cycleStart, now)).toBeNull();
  });

  it("rejects a future date", () => {
    expect(parseTransactionDate("2026-08-16", cycleStart, now)).toBeNull();
  });

  it("rejects a malformed string", () => {
    expect(parseTransactionDate("not-a-date", cycleStart, now)).toBeNull();
  });

  it("uses a long-running cycle's start correctly (not fixed to a lookback window like parsePayDate)", () => {
    // A cycle that's been open 20 days — well beyond parsePayDate's 7-day
    // lookback — still accepts its own start date.
    const longCycleStart = new Date(2026, 6, 26); // Jul 26, 2026
    expect(parseTransactionDate("2026-07-26", longCycleStart, now)).toEqual(new Date(2026, 6, 26));
  });
});
