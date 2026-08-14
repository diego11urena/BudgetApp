import { describe, expect, it } from "vitest";
import { computeQuincenaPace, quincenaLengthDays } from "./quincena-pace";

// Regression anchor for the "hardcoded 15-day quincena" bug: a first-half
// cycle really is always 15 days (day 1-15, every month), but a
// second-half cycle's real length is "days in this month minus 15" —
// 16 in a 31-day month, 15 in a 30-day month, 13 in a (non-leap) February.
// Before this fix, every one of these silently used 15 regardless.
describe("quincenaLengthDays", () => {
  it("is always 15 for a first-half cycle, regardless of the month's length", () => {
    expect(quincenaLengthDays(new Date(2026, 0, 1))).toBe(15); // Jan, 31 days
    expect(quincenaLengthDays(new Date(2026, 1, 1))).toBe(15); // Feb, 28 days
    expect(quincenaLengthDays(new Date(2026, 8, 1))).toBe(15); // Sep, 30 days
  });

  it("is 16 for a second-half cycle in a 31-day month", () => {
    expect(quincenaLengthDays(new Date(2026, 6, 16))).toBe(16); // Jul
  });

  it("is 15 for a second-half cycle in a 30-day month", () => {
    expect(quincenaLengthDays(new Date(2026, 8, 16))).toBe(15); // Sep
  });

  it("is 13 for a second-half cycle in a non-leap February", () => {
    expect(quincenaLengthDays(new Date(2026, 1, 16))).toBe(13); // Feb 2026 (28 days)
  });
});

describe("computeQuincenaPace", () => {
  it("counts today as one of the 15 days on day 1 of the cycle", () => {
    const pace = computeQuincenaPace({
      periodStart: new Date(2026, 7, 1),
      now: new Date(2026, 7, 1),
      amountLeft: 750,
      totalExpenses: 0,
    });
    expect(pace.daysRemaining).toBe(15);
    expect(pace.perDay).toBeCloseTo(50, 2);
    expect(pace.isLastDay).toBe(false);
  });

  it("gives a second-half cycle in a 31-day month its real 16-day length, not a hardcoded 15", () => {
    const pace = computeQuincenaPace({
      periodStart: new Date(2026, 6, 16), // Jul 16
      now: new Date(2026, 6, 16),
      amountLeft: 800,
      totalExpenses: 0,
    });
    expect(pace.daysRemaining).toBe(16);
    expect(pace.perDay).toBeCloseTo(50, 2);
  });

  it("flags the last day of the quincena", () => {
    const pace = computeQuincenaPace({
      periodStart: new Date(2026, 7, 1),
      now: new Date(2026, 7, 15),
      amountLeft: 40,
      totalExpenses: 0,
    });
    expect(pace.daysRemaining).toBe(1);
    expect(pace.isLastDay).toBe(true);
  });

  it("clamps to zero once the cycle has run past its nominal 15 days", () => {
    const pace = computeQuincenaPace({
      periodStart: new Date(2026, 7, 1),
      now: new Date(2026, 7, 20),
      amountLeft: 40,
      totalExpenses: 0,
    });
    expect(pace.daysRemaining).toBe(0);
    expect(pace.isLastDay).toBe(true);
  });

  it("is not over pace when spending so far is under the sustainable rate", () => {
    const pace = computeQuincenaPace({
      periodStart: new Date(2026, 7, 1),
      now: new Date(2026, 7, 5),
      amountLeft: 660,
      totalExpenses: 40,
    });
    // 5 days elapsed, $8/day so far; 11 days remaining, $60/day sustainable.
    expect(pace.isOverPace).toBe(false);
  });

  it("flags over pace when spending so far exceeds the sustainable rate", () => {
    const pace = computeQuincenaPace({
      periodStart: new Date(2026, 7, 1),
      now: new Date(2026, 7, 5),
      amountLeft: 200,
      totalExpenses: 400,
    });
    // 5 days elapsed, $80/day so far; 11 days remaining, ~$18.18/day sustainable.
    expect(pace.isOverPace).toBe(true);
  });

  it("is over pace whenever the balance has already gone negative", () => {
    const pace = computeQuincenaPace({
      periodStart: new Date(2026, 7, 1),
      now: new Date(2026, 7, 5),
      amountLeft: -50,
      totalExpenses: 300,
    });
    expect(pace.perDay).toBeLessThan(0);
    expect(pace.isOverPace).toBe(true);
  });

  // Regression anchor for the "Edit pay info doesn't update Home" bug:
  // computeQuincenaPace itself was never the problem (it's always derived
  // live from periodStart, nothing stored/stale) — these two cases pin
  // down that moving periodStart earlier changes daysRemaining/perDay
  // exactly as it should, so a future regression in the *propagation*
  // (revalidation/refresh) can't hide behind "well, the math might be
  // wrong too."
  it("editing the pay date backward shortens daysRemaining accordingly (matches the reported repro)", () => {
    const before = computeQuincenaPace({
      periodStart: new Date(2026, 7, 12), // Aug 12
      now: new Date(2026, 7, 13), // Aug 13
      amountLeft: 226.39,
      totalExpenses: 0,
    });
    const afterEditingPayDateBack = computeQuincenaPace({
      periodStart: new Date(2026, 6, 31), // Jul 31 (moved 13 days earlier)
      now: new Date(2026, 7, 13), // same "today"
      amountLeft: 226.39,
      totalExpenses: 0,
    });
    expect(afterEditingPayDateBack.daysRemaining).toBeLessThan(before.daysRemaining);
    // 3, not 2: Jul 31 falls in July's second half, which is 16 days (July
    // has 31 days) rather than the old hardcoded 15 — quincenaLengthDays'
    // whole fix. Jul31 + 15 days (16-day length) = Aug15; Aug13..Aug15
    // inclusive is 3 days.
    expect(afterEditingPayDateBack.daysRemaining).toBe(3);
    expect(afterEditingPayDateBack.perDay).toBeCloseTo(75.46, 2);
  });

  it("editing the pay date forward lengthens daysRemaining accordingly", () => {
    const before = computeQuincenaPace({
      periodStart: new Date(2026, 7, 1),
      now: new Date(2026, 7, 5),
      amountLeft: 500,
      totalExpenses: 0,
    });
    const afterEditingPayDateForward = computeQuincenaPace({
      periodStart: new Date(2026, 7, 5), // moved to today
      now: new Date(2026, 7, 5),
      amountLeft: 500,
      totalExpenses: 0,
    });
    expect(afterEditingPayDateForward.daysRemaining).toBeGreaterThan(before.daysRemaining);
    expect(afterEditingPayDateForward.daysRemaining).toBe(15);
  });
});
