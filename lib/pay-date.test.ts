import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addDays, formatCycleLabel, hourInPanama, nowInPanama, parsePayDate, parseTransactionDate } from "./pay-date";

// Mirrors pay-date.ts's own panamaMidnight anchor (Panama midnight = 05:00
// UTC, since Panama is UTC-5 year-round) so every expected/input value in
// this file is correct regardless of which machine runs the test — never
// `new Date(y, m, d)` (the local-timezone constructor), which only agrees
// with the real Panama-anchored value when the test runner's own system
// timezone happens to be Panama. (It coincidentally is on a Panama-based
// dev machine, which is exactly how this file's old local-constructor
// assertions passed everywhere they were run until CI's UTC runner.)
function panama(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 5, 0, 0));
}

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
    expect(nowInPanama()).toEqual(panama(2026, 8, 14));
    expect(hourInPanama()).toBe(21);
  });

  it("agrees with the server's own UTC day once Panama has also rolled over", () => {
    // 2026-08-15 06:00 UTC = 2026-08-15 01:00 in Panama -- both sides now
    // agree it's the 15th.
    vi.setSystemTime(new Date("2026-08-15T06:00:00.000Z"));
    expect(nowInPanama()).toEqual(panama(2026, 8, 15));
    expect(hourInPanama()).toBe(1);
  });
});

// Regression anchor for T7 (fix-list batch 7.5): addDays used to read/write
// via setDate()/getDate(), the *local-timezone* Date methods -- correct only
// by coincidence, since this app has only ever run from Vercel's UTC servers
// or a Panama-timezone dev machine. Re-run under a timezone far from both to
// catch a regression back to that pattern.
describe("addDays", () => {
  it("adds a positive count of days", () => {
    expect(addDays(panama(2026, 8, 10), 5)).toEqual(panama(2026, 8, 15));
  });

  it("subtracts with a negative count", () => {
    expect(addDays(panama(2026, 8, 10), -3)).toEqual(panama(2026, 8, 7));
  });

  it("rolls over a month boundary", () => {
    expect(addDays(panama(2026, 8, 29), 5)).toEqual(panama(2026, 9, 3));
  });

  it("rolls over a year boundary", () => {
    expect(addDays(panama(2026, 12, 30), 5)).toEqual(panama(2027, 1, 4));
  });
});

describe("formatCycleLabel", () => {
  it("formats as zero-padded YYYY-MM-DD", () => {
    expect(formatCycleLabel(panama(2026, 1, 5))).toBe("2026-01-05");
  });

  it("pads single-digit months and days", () => {
    expect(formatCycleLabel(panama(2026, 9, 2))).toBe("2026-09-02");
  });

  it("does not pad a 4-digit year further and handles double-digit month/day", () => {
    expect(formatCycleLabel(panama(2026, 12, 25))).toBe("2026-12-25");
  });

  it("defaults to Panama's current date when called with no argument, not the runner's own local date", () => {
    vi.useFakeTimers();
    // 2026-08-15 23:30 UTC = 2026-08-15 18:30 in Panama -- deliberately far
    // from the UTC/Panama day-boundary window the block above already
    // covers, since this test is only about "does the default come from
    // nowInPanama()," not a repeat of that boundary check.
    vi.setSystemTime(new Date("2026-08-15T23:30:00.000Z"));
    expect(formatCycleLabel()).toBe("2026-08-15");
    vi.useRealTimers();
  });

  // Regression anchor for the "Date built on one machine, read via local
  // getters on another" class of bug (see the panamaMidnight comment in
  // pay-date.ts): TransactionList.tsx reads a server-constructed
  // CycleTransaction.occurredAt back out client-side, in the user's own
  // browser, to pre-fill an edit sheet's date field. formatCycleLabel must
  // recover the right calendar day for that instant no matter what
  // timezone is reading it — it always goes through panamaDateParts
  // (Intl, explicit America/Panama), never the local getters
  // (getFullYear/getMonth/getDate) that broke this.
  it("recovers the correct calendar day for a UTC-constructed instant, not the runner's own local day", () => {
    const storedOccurredAt = new Date("2026-08-20T05:00:00.000Z"); // Panama midnight for Aug 20
    expect(formatCycleLabel(storedOccurredAt)).toBe("2026-08-20");
  });
});

describe("parsePayDate", () => {
  const now = panama(2026, 8, 15); // Aug 15, 2026

  it("parses a well-formed date within range", () => {
    const result = parsePayDate("2026-08-12", now);
    expect(result).toEqual(panama(2026, 8, 12));
  });

  it("accepts today itself", () => {
    expect(parsePayDate("2026-08-15", now)).toEqual(panama(2026, 8, 15));
  });

  it("accepts exactly the lookback boundary (7 days back)", () => {
    expect(parsePayDate("2026-08-08", now)).toEqual(panama(2026, 8, 8));
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
    const marchNow = panama(2026, 3, 5); // Mar 5, 2026
    expect(parsePayDate("2026-02-30", marchNow)).toBeNull();
  });
});

describe("parseTransactionDate", () => {
  const now = panama(2026, 8, 15); // Aug 15, 2026
  const cycleStart = panama(2026, 8, 1); // Aug 1, 2026

  it("parses a date within the cycle", () => {
    expect(parseTransactionDate("2026-08-10", cycleStart, now)).toEqual(panama(2026, 8, 10));
  });

  it("accepts today itself", () => {
    expect(parseTransactionDate("2026-08-15", cycleStart, now)).toEqual(panama(2026, 8, 15));
  });

  it("accepts exactly the cycle's start date", () => {
    expect(parseTransactionDate("2026-08-01", cycleStart, now)).toEqual(panama(2026, 8, 1));
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
    const longCycleStart = panama(2026, 7, 26); // Jul 26, 2026
    expect(parseTransactionDate("2026-07-26", longCycleStart, now)).toEqual(panama(2026, 7, 26));
  });
});
