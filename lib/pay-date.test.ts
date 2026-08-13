import { describe, expect, it } from "vitest";
import { formatCycleLabel, parsePayDate } from "./pay-date";

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
