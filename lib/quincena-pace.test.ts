import { describe, expect, it } from "vitest";
import {
  computeCyclePace,
  cycleEnd,
  cycleLengthDays,
  dueDayFallsWithinCycle,
  monthEnd,
  monthLengthDays,
  nextCycleStart,
  quincenaLengthDays,
} from "./quincena-pace";

// Mirrors pay-date.ts's own panamaMidnight anchor (Panama midnight = 05:00
// UTC, since Panama is UTC-5 year-round) so every date in this file is
// correct regardless of which machine/timezone runs the test — never
// `new Date(y, m, d)` (the local-timezone constructor), which only agrees
// with the real Panama-anchored value when the test runner's own system
// timezone happens to be Panama. Same pattern as lib/pay-date.test.ts's
// own `panama()` helper.
function panama(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 5, 0, 0));
}

// Regression anchor for the "hardcoded 15-day quincena" bug: a first-half
// cycle really is always 15 days (day 1-15, every month), but a
// second-half cycle's real length is "days in this month minus 15" —
// 16 in a 31-day month, 15 in a 30-day month, 13 in a (non-leap) February.
// Before this fix, every one of these silently used 15 regardless.
describe("quincenaLengthDays", () => {
  it("is always 15 for a first-half cycle, regardless of the month's length", () => {
    expect(quincenaLengthDays(panama(2026, 1, 1))).toBe(15); // Jan, 31 days
    expect(quincenaLengthDays(panama(2026, 2, 1))).toBe(15); // Feb, 28 days
    expect(quincenaLengthDays(panama(2026, 9, 1))).toBe(15); // Sep, 30 days
  });

  it("is 16 for a second-half cycle in a 31-day month", () => {
    expect(quincenaLengthDays(panama(2026, 7, 16))).toBe(16); // Jul
  });

  it("is 15 for a second-half cycle in a 30-day month", () => {
    expect(quincenaLengthDays(panama(2026, 9, 16))).toBe(15); // Sep
  });

  it("is 13 for a second-half cycle in a non-leap February", () => {
    expect(quincenaLengthDays(panama(2026, 2, 16))).toBe(13); // Feb 2026 (28 days)
  });
});

describe("computeCyclePace", () => {
  it("counts today as one of the 15 days on day 1 of the cycle, phase running", () => {
    const pace = computeCyclePace({
      frequency: "QUINCENAL",
      periodStart: panama(2026, 8, 1),
      now: panama(2026, 8, 1),
      amountLeft: 750,
      totalExpenses: 0,
    });
    expect(pace.daysRemaining).toBe(15);
    expect(pace.perDay).toBeCloseTo(50, 2);
    expect(pace.phase).toBe("running");
    expect(pace.isLastDay).toBe(false);
  });

  it("is still 'running' with exactly 2 days left, not yet 'last-day'", () => {
    const pace = computeCyclePace({
      frequency: "QUINCENAL",
      periodStart: panama(2026, 8, 1),
      now: panama(2026, 8, 14),
      amountLeft: 100,
      totalExpenses: 0,
    });
    expect(pace.daysRemaining).toBe(2);
    expect(pace.phase).toBe("running");
  });

  it("gives a second-half cycle in a 31-day month its real 16-day length, not a hardcoded 15", () => {
    const pace = computeCyclePace({
      frequency: "QUINCENAL",
      periodStart: panama(2026, 7, 16), // Jul 16
      now: panama(2026, 7, 16),
      amountLeft: 800,
      totalExpenses: 0,
    });
    expect(pace.daysRemaining).toBe(16);
    expect(pace.perDay).toBeCloseTo(50, 2);
  });

  it("flags the last day of the quincena as phase 'last-day', never daysRemaining 0", () => {
    const pace = computeCyclePace({
      frequency: "QUINCENAL",
      periodStart: panama(2026, 8, 1),
      now: panama(2026, 8, 15),
      amountLeft: 40,
      totalExpenses: 0,
    });
    expect(pace.daysRemaining).toBe(1);
    expect(pace.phase).toBe("last-day");
    expect(pace.isLastDay).toBe(true);
  });

  // Regression anchor: this used to also flag daysRemaining === 0 as
  // isLastDay (the old rule was daysRemaining <= 1), producing the
  // self-contradictory "0 days left · Last day of this quincena" -- zero
  // days left means the quincena already ended, not that today is its
  // last day. "ended" is now a distinct third phase, and cycleEnd
  // surfaces the actual date that already passed.
  it("clamps to zero and reports 'ended', not 'last-day', once the cycle has run past its nominal 15 days", () => {
    const pace = computeCyclePace({
      frequency: "QUINCENAL",
      periodStart: panama(2026, 8, 1),
      now: panama(2026, 8, 20),
      amountLeft: 40,
      totalExpenses: 0,
    });
    expect(pace.daysRemaining).toBe(0);
    expect(pace.phase).toBe("ended");
    expect(pace.isLastDay).toBe(false);
    expect(pace.cycleEnd).toEqual(panama(2026, 8, 15));
  });

  it("one day after the end is still 'ended', not some fourth state", () => {
    const pace = computeCyclePace({
      frequency: "QUINCENAL",
      periodStart: panama(2026, 8, 1),
      now: panama(2026, 8, 16),
      amountLeft: 40,
      totalExpenses: 0,
    });
    expect(pace.daysRemaining).toBe(0);
    expect(pace.phase).toBe("ended");
  });

  // A second-half quincena in February (13 real days -- see
  // quincenaLengthDays above) should end on the 28th, not a hardcoded
  // "start + 15" that would overshoot into March.
  it("ends a February second-half quincena on the 28th, not the 30th", () => {
    const pace = computeCyclePace({
      frequency: "QUINCENAL",
      periodStart: panama(2026, 2, 16),
      now: panama(2026, 2, 16),
      amountLeft: 100,
      totalExpenses: 0,
    });
    expect(pace.cycleEnd).toEqual(panama(2026, 2, 28));
  });

  // Fix 1.3/F3: computeQuincenaPace used to always derive the cycle end
  // from the calendar, ignoring a stored periodEnd even when one exists
  // (only ever set once a payday has been edited or the cycle closed) --
  // meaning Home's own "N days remaining" could silently disagree with
  // the date range the header shows for that same cycle.
  it("prefers an explicit periodEnd over the calendar-derived one when both exist and disagree", () => {
    const editedPeriodEnd = panama(2026, 8, 20); // 5 days later than the calendar default (Aug 15)
    const pace = computeCyclePace({
      frequency: "QUINCENAL",
      periodStart: panama(2026, 8, 1),
      periodEnd: editedPeriodEnd,
      now: panama(2026, 8, 16),
      amountLeft: 250,
      totalExpenses: 0,
    });
    expect(pace.cycleEnd).toEqual(editedPeriodEnd);
    // Aug 16..Aug 20 inclusive = 5 days, not the calendar default's 0.
    expect(pace.daysRemaining).toBe(5);
    expect(pace.phase).toBe("running");
  });

  it("falls back to the calendar-derived end when periodEnd is null", () => {
    const pace = computeCyclePace({
      frequency: "QUINCENAL",
      periodStart: panama(2026, 8, 1),
      periodEnd: null,
      now: panama(2026, 8, 1),
      amountLeft: 750,
      totalExpenses: 0,
    });
    expect(pace.cycleEnd).toEqual(panama(2026, 8, 15));
  });

  it("is not over pace when spending so far is under the sustainable rate", () => {
    const pace = computeCyclePace({
      frequency: "QUINCENAL",
      periodStart: panama(2026, 8, 1),
      now: panama(2026, 8, 5),
      amountLeft: 660,
      totalExpenses: 40,
    });
    // 5 days elapsed, $8/day so far; 11 days remaining, $60/day sustainable.
    expect(pace.isOverPace).toBe(false);
  });

  it("flags over pace when spending so far exceeds the sustainable rate", () => {
    const pace = computeCyclePace({
      frequency: "QUINCENAL",
      periodStart: panama(2026, 8, 1),
      now: panama(2026, 8, 5),
      amountLeft: 200,
      totalExpenses: 400,
    });
    // 5 days elapsed, $80/day so far; 11 days remaining, ~$18.18/day sustainable.
    expect(pace.isOverPace).toBe(true);
  });

  it("is over pace whenever the balance has already gone negative", () => {
    const pace = computeCyclePace({
      frequency: "QUINCENAL",
      periodStart: panama(2026, 8, 1),
      now: panama(2026, 8, 5),
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
    const before = computeCyclePace({
      frequency: "QUINCENAL",
      periodStart: panama(2026, 8, 12), // Aug 12
      now: panama(2026, 8, 13), // Aug 13
      amountLeft: 226.39,
      totalExpenses: 0,
    });
    const afterEditingPayDateBack = computeCyclePace({
      frequency: "QUINCENAL",
      periodStart: panama(2026, 7, 31), // Jul 31 (moved 13 days earlier)
      now: panama(2026, 8, 13), // same "today"
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
    const before = computeCyclePace({
      frequency: "QUINCENAL",
      periodStart: panama(2026, 8, 1),
      now: panama(2026, 8, 5),
      amountLeft: 500,
      totalExpenses: 0,
    });
    const afterEditingPayDateForward = computeCyclePace({
      frequency: "QUINCENAL",
      periodStart: panama(2026, 8, 5), // moved to today
      now: panama(2026, 8, 5),
      amountLeft: 500,
      totalExpenses: 0,
    });
    expect(afterEditingPayDateForward.daysRemaining).toBeGreaterThan(before.daysRemaining);
    expect(afterEditingPayDateForward.daysRemaining).toBe(15);
  });

  it("elapsedFraction is 1/15 on day 1 of a 15-day cycle and 1 on the last day", () => {
    const day1 = computeCyclePace({
      frequency: "QUINCENAL",
      periodStart: panama(2026, 8, 1),
      now: panama(2026, 8, 1),
      amountLeft: 750,
      totalExpenses: 0,
    });
    expect(day1.elapsedFraction).toBeCloseTo(1 / 15, 4);

    const lastDay = computeCyclePace({
      frequency: "QUINCENAL",
      periodStart: panama(2026, 8, 1),
      now: panama(2026, 8, 15),
      amountLeft: 0,
      totalExpenses: 750,
    });
    expect(lastDay.elapsedFraction).toBe(1);
  });

  it("elapsedFraction stays clamped at 1 once a stale cycle runs past its nominal end", () => {
    const stale = computeCyclePace({
      frequency: "QUINCENAL",
      periodStart: panama(2026, 8, 1),
      now: panama(2026, 8, 20),
      amountLeft: 0,
      totalExpenses: 750,
    });
    expect(stale.elapsedFraction).toBe(1);
  });

  // MONTHLY regression coverage -- same shapes as the QUINCENAL cases
  // above, so a future change can't silently regress one cadence while
  // fixing the other.
  it("MONTHLY: a full calendar month's pace, day 1", () => {
    const pace = computeCyclePace({
      frequency: "MONTHLY",
      periodStart: panama(2026, 8, 16), // -> ends Sep 15 (31 days)
      now: panama(2026, 8, 16),
      amountLeft: 3100,
      totalExpenses: 0,
    });
    expect(pace.daysRemaining).toBe(31);
    expect(pace.perDay).toBeCloseTo(100, 2);
    expect(pace.phase).toBe("running");
    expect(pace.cycleEnd).toEqual(panama(2026, 9, 15));
  });

  it("MONTHLY: elapsedFraction derives from the real ~31-day month, not a hardcoded 15", () => {
    const pace = computeCyclePace({
      frequency: "MONTHLY",
      periodStart: panama(2026, 8, 16),
      now: panama(2026, 8, 16),
      amountLeft: 3100,
      totalExpenses: 0,
    });
    expect(pace.elapsedFraction).toBeCloseTo(1 / 31, 4);
  });

  it("MONTHLY: clamps a Jan 31 start to Feb 28's real last day, not overflowing into March", () => {
    const pace = computeCyclePace({
      frequency: "MONTHLY",
      periodStart: panama(2026, 1, 31),
      now: panama(2026, 1, 31),
      amountLeft: 100,
      totalExpenses: 0,
    });
    expect(pace.cycleEnd).toEqual(panama(2026, 2, 27));
  });
});

describe("monthEnd / monthLengthDays", () => {
  it("a mid-month start ends the day before the same day next month", () => {
    expect(monthEnd(panama(2026, 8, 16))).toEqual(panama(2026, 9, 15));
    expect(monthLengthDays(panama(2026, 8, 16))).toBe(31);
  });

  it("clamps a 31st start to the following month's real last day", () => {
    expect(monthEnd(panama(2026, 1, 31))).toEqual(panama(2026, 2, 27));
    expect(monthLengthDays(panama(2026, 1, 31))).toBe(28);
  });

  it("clamps a leap-February start of the 29th correctly for a non-leap next February", () => {
    // 2027 isn't a leap year -- Jan 29, 2027 -> Feb 28, 2027 (last real day), inclusive end Feb 27.
    expect(monthEnd(panama(2027, 1, 29))).toEqual(panama(2027, 2, 27));
  });
});

describe("cycleEnd / cycleLengthDays dispatchers", () => {
  it("QUINCENAL dispatches to quincenaEnd/quincenaLengthDays", () => {
    expect(cycleEnd(panama(2026, 8, 1), "QUINCENAL")).toEqual(panama(2026, 8, 15));
    expect(cycleLengthDays(panama(2026, 8, 1), "QUINCENAL")).toBe(15);
  });

  it("MONTHLY dispatches to monthEnd/monthLengthDays", () => {
    expect(cycleEnd(panama(2026, 8, 1), "MONTHLY")).toEqual(panama(2026, 8, 31));
    expect(cycleLengthDays(panama(2026, 8, 1), "MONTHLY")).toBe(31);
  });
});

describe("nextCycleStart", () => {
  it("QUINCENAL: the day after quincenaEnd", () => {
    expect(nextCycleStart(panama(2026, 8, 1), "QUINCENAL")).toEqual(panama(2026, 8, 16));
  });

  it("MONTHLY: the day after monthEnd", () => {
    expect(nextCycleStart(panama(2026, 8, 16), "MONTHLY")).toEqual(panama(2026, 9, 16));
  });
});

describe("dueDayFallsWithinCycle", () => {
  // QUINCENAL regression safety: reproduces the old quincenaForDay bucket
  // behavior exactly (day <= 15 -> first half, else second half).
  it("QUINCENAL: a first-half dueDay falls within a first-half cycle", () => {
    expect(dueDayFallsWithinCycle(5, panama(2026, 8, 1), "QUINCENAL")).toBe(true);
  });

  it("QUINCENAL: a first-half dueDay does NOT fall within a second-half cycle", () => {
    expect(dueDayFallsWithinCycle(5, panama(2026, 8, 16), "QUINCENAL")).toBe(false);
  });

  it("QUINCENAL: a second-half dueDay falls within a second-half cycle", () => {
    expect(dueDayFallsWithinCycle(20, panama(2026, 8, 16), "QUINCENAL")).toBe(true);
  });

  it("QUINCENAL: a second-half dueDay does NOT fall within a first-half cycle", () => {
    expect(dueDayFallsWithinCycle(20, panama(2026, 8, 1), "QUINCENAL")).toBe(false);
  });

  it("QUINCENAL: dueDay 31 falls within the second half of a 31-day month", () => {
    expect(dueDayFallsWithinCycle(31, panama(2026, 7, 16), "QUINCENAL")).toBe(true);
  });

  // MONTHLY: every day 1-31 falls inside a single whole-month cycle --
  // the behavior that actually motivated this rewrite (a MONTHLY-frequency
  // bill must now carry into every monthly cycle, not just one bucket).
  it("MONTHLY: an early-month dueDay falls within the cycle", () => {
    expect(dueDayFallsWithinCycle(3, panama(2026, 8, 16), "MONTHLY")).toBe(true);
  });

  it("MONTHLY: a late-month dueDay falls within the cycle", () => {
    expect(dueDayFallsWithinCycle(28, panama(2026, 8, 16), "MONTHLY")).toBe(true);
  });

  it("MONTHLY: dueDay 31 falls within a cycle spanning a 31-day stretch", () => {
    expect(dueDayFallsWithinCycle(31, panama(2026, 8, 16), "MONTHLY")).toBe(true);
  });

  it("MONTHLY: a dueDay before periodStart's own day-of-month still falls within the next month's occurrence", () => {
    // periodStart Aug 20 -> cycle runs Aug 20-Sep 19; dueDay 5 has no
    // occurrence in that range in August (Aug 5 is before periodStart) but
    // does in September (Sep 5).
    expect(dueDayFallsWithinCycle(5, panama(2026, 8, 20), "MONTHLY")).toBe(true);
  });

  it("MONTHLY: a dueDay whose only occurrence in range is exactly periodStart's own day", () => {
    expect(dueDayFallsWithinCycle(20, panama(2026, 8, 20), "MONTHLY")).toBe(true);
  });
});
