import { describe, expect, it } from "vitest";
import { formatCurrency, formatFriendlyDate } from "./format";

// Mirrors pay-date.ts's own panamaMidnight anchor (Panama midnight = 05:00
// UTC, since Panama is UTC-5 year-round).
function panama(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 5, 0, 0));
}

describe("formatCurrency", () => {
  it("formats with thousands separators and two decimals", () => {
    expect(formatCurrency(1234.5)).toBe("$1,234.50");
  });
});

describe("formatFriendlyDate", () => {
  it("formats as \"Mon D, YYYY\"", () => {
    expect(formatFriendlyDate(panama(2026, 8, 11))).toBe("Aug 11, 2026");
  });

  // Regression anchor for T3 (fix-list batch 7.5): toLocaleDateString
  // without an explicit timeZone reads the *calling machine's* local
  // timezone -- correct only by coincidence on Vercel's UTC servers or a
  // Panama-timezone dev machine. A Panama-midnight-anchored Date (05:00
  // UTC) read back in a positive-UTC-offset timezone lands on the
  // *previous* calendar day without the fix.
  it("stays anchored to Panama's calendar day regardless of the caller's own timezone", () => {
    const originalTz = process.env.TZ;
    try {
      process.env.TZ = "Asia/Tokyo";
      expect(formatFriendlyDate(panama(2026, 8, 11))).toBe("Aug 11, 2026");
    } finally {
      process.env.TZ = originalTz;
    }
  });
});
