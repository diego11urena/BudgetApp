import { describe, expect, it } from "vitest";
import { computeQuincenaPace } from "./quincena-pace";

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
    expect(afterEditingPayDateBack.daysRemaining).toBe(2);
    expect(afterEditingPayDateBack.perDay).toBeCloseTo(113.2, 1);
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
