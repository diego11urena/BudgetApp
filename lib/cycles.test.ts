import { describe, expect, it } from "vitest";
import { formatCycleRangeText, latestGoalPerCategory, shouldCarryForwardToCycle } from "./cycles";

// Mirrors pay-date.ts's own panamaMidnight anchor (Panama midnight = 05:00
// UTC, since Panama is UTC-5 year-round) -- shouldCarryForwardToCycle and
// formatCycleRangeText both read their Date inputs via panamaDateParts now
// (fix-list T5/T4), so a local `new Date(y, m, d)` input here would
// disagree with the real Panama-anchored value on any test machine outside
// UTC-5/no-DST, e.g. TZ=Asia/Tokyo landing a "local midnight" input on the
// previous UTC day.
function panama(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 5, 0, 0));
}

describe("shouldCarryForwardToCycle", () => {
  // QUINCENAL regression safety -- reproduces exactly the old
  // quincenaForDay bucket-comparison behavior via the new date-range-
  // containment check (dueDayFallsWithinCycle).
  // PanaPass: fixed amount, BIWEEKLY -> must appear in every single cycle.
  it("PanaPass (BIWEEKLY) carries into a cycle starting in the first quincena", () => {
    const rule = { frequency: "BIWEEKLY" as const, dueDay: null };
    expect(shouldCarryForwardToCycle(rule, panama(2026, 8, 3), "QUINCENAL")).toBe(true);
  });

  it("PanaPass (BIWEEKLY) carries into a cycle starting in the second quincena too", () => {
    const rule = { frequency: "BIWEEKLY" as const, dueDay: null };
    expect(shouldCarryForwardToCycle(rule, panama(2026, 8, 20), "QUINCENAL")).toBe(true);
  });

  it("PanaPass (BIWEEKLY) carries in regardless of dueDay being set", () => {
    // Frequency alone decides for BIWEEKLY -- dueDay is a MONTHLY-only concept.
    const rule = { frequency: "BIWEEKLY" as const, dueDay: 5 };
    expect(shouldCarryForwardToCycle(rule, panama(2026, 8, 20), "QUINCENAL")).toBe(true);
  });

  // Gym: fixed amount, MONTHLY, due near month-end (dueDay 28) -> must show
  // up ONLY in the second quincena of each month, never the first.
  it("Gym (MONTHLY, dueDay 28) does NOT carry into a cycle starting in the first quincena", () => {
    const rule = { frequency: "MONTHLY" as const, dueDay: 28 };
    expect(shouldCarryForwardToCycle(rule, panama(2026, 8, 3), "QUINCENAL")).toBe(false);
  });

  it("Gym (MONTHLY, dueDay 28) DOES carry into a cycle starting in the second quincena", () => {
    const rule = { frequency: "MONTHLY" as const, dueDay: 28 };
    expect(shouldCarryForwardToCycle(rule, panama(2026, 8, 20), "QUINCENAL")).toBe(true);
  });

  // Canonical periodStarts (1st/16th) here, not an arbitrary edited payday
  // like the 3rd/10th/20th used above -- the date-range-containment check
  // and the old day-of-month-bucket comparison only exactly agree when the
  // cycle boundary itself lands on the canonical 1st/16th anchor (see the
  // "an edited payday" test below for the case where they deliberately
  // diverge, and why the new behavior is the correct one).
  it("a MONTHLY rule due on the 15th (boundary) carries only into the first quincena", () => {
    const rule = { frequency: "MONTHLY" as const, dueDay: 15 };
    expect(shouldCarryForwardToCycle(rule, panama(2026, 8, 1), "QUINCENAL")).toBe(true);
    expect(shouldCarryForwardToCycle(rule, panama(2026, 8, 16), "QUINCENAL")).toBe(false);
  });

  it("a MONTHLY rule due on the 16th carries only into the second quincena", () => {
    const rule = { frequency: "MONTHLY" as const, dueDay: 16 };
    expect(shouldCarryForwardToCycle(rule, panama(2026, 8, 1), "QUINCENAL")).toBe(false);
    expect(shouldCarryForwardToCycle(rule, panama(2026, 8, 16), "QUINCENAL")).toBe(true);
  });

  it("a MONTHLY rule with no dueDay set never carries forward (safe default)", () => {
    const rule = { frequency: "MONTHLY" as const, dueDay: null };
    expect(shouldCarryForwardToCycle(rule, panama(2026, 8, 3), "QUINCENAL")).toBe(false);
    expect(shouldCarryForwardToCycle(rule, panama(2026, 8, 20), "QUINCENAL")).toBe(false);
  });

  // The old day-of-month bucket comparison only ever looked at which
  // "half" periodStart's own day fell in -- it never checked whether the
  // cycle's REAL date range actually contains dueDay's occurrence. For an
  // edited/irregular payday (fully supported -- see EditPayInfoSheet) that
  // isn't the canonical 1st/16th, this could get it wrong: a cycle running
  // Aug10-Aug24 for a dueDay-16 bill genuinely covers that bill's due date,
  // and now correctly carries it forward, even though Aug10's own
  // day-of-month "bucket" (first half) used to disagree with dueDay 16's
  // bucket (second half).
  it("an edited (non-canonical) payday correctly carries in a dueDay its actual date range covers", () => {
    const rule = { frequency: "MONTHLY" as const, dueDay: 16 };
    // Cycle range Aug10-Aug24 genuinely contains Aug16.
    expect(shouldCarryForwardToCycle(rule, panama(2026, 8, 10), "QUINCENAL")).toBe(true);
  });

  // MONTHLY cadence -- a single cycle spans the whole month, so BIWEEKLY
  // still carries into every cycle (once per cycle, by definition) and a
  // MONTHLY-frequency rule now carries into every cycle too, regardless of
  // which day of the month its dueDay is -- the behavior that motivated
  // replacing the old two-bucket check with real date containment.
  it("MONTHLY cadence: PanaPass (BIWEEKLY) still carries into a monthly cycle", () => {
    const rule = { frequency: "BIWEEKLY" as const, dueDay: null };
    expect(shouldCarryForwardToCycle(rule, panama(2026, 8, 16), "MONTHLY")).toBe(true);
  });

  it("MONTHLY cadence: Gym (MONTHLY, dueDay 28) carries into the one monthly cycle that contains it", () => {
    const rule = { frequency: "MONTHLY" as const, dueDay: 28 };
    expect(shouldCarryForwardToCycle(rule, panama(2026, 8, 16), "MONTHLY")).toBe(true);
  });

  it("MONTHLY cadence: a MONTHLY rule due early in the month still carries in", () => {
    const rule = { frequency: "MONTHLY" as const, dueDay: 3 };
    expect(shouldCarryForwardToCycle(rule, panama(2026, 8, 16), "MONTHLY")).toBe(true);
  });

  it("MONTHLY cadence: a MONTHLY rule with no dueDay set still never carries forward", () => {
    const rule = { frequency: "MONTHLY" as const, dueDay: null };
    expect(shouldCarryForwardToCycle(rule, panama(2026, 8, 16), "MONTHLY")).toBe(false);
  });
});

describe("latestGoalPerCategory", () => {
  it("keeps only the first (newest) goal per expenseCategoryId", () => {
    const goals = [
      { id: "g3", expenseCategoryId: "gym", targetAmount: 30 },
      { id: "g2", expenseCategoryId: "gym", targetAmount: 25 },
      { id: "g1", expenseCategoryId: "gym", targetAmount: 20 },
    ];
    const result = latestGoalPerCategory(goals);
    expect(result.size).toBe(1);
    expect(result.get("gym")).toEqual(goals[0]);
  });

  it("tracks each category independently", () => {
    const goals = [
      { id: "g1", expenseCategoryId: "gym", targetAmount: 30 },
      { id: "g2", expenseCategoryId: "panapass", targetAmount: 15 },
      { id: "g3", expenseCategoryId: "gym", targetAmount: 20 },
    ];
    const result = latestGoalPerCategory(goals);
    expect(result.size).toBe(2);
    expect(result.get("gym")).toEqual(goals[0]);
    expect(result.get("panapass")).toEqual(goals[1]);
  });

  it("returns an empty map for an empty list", () => {
    expect(latestGoalPerCategory([]).size).toBe(0);
  });
});

describe("formatCycleRangeText", () => {
  it("includes the year by default", () => {
    const cycle = { periodStart: panama(2026, 8, 1), periodEnd: panama(2026, 8, 15) };
    expect(formatCycleRangeText(cycle)).toBe("Aug 1–15, 2026");
  });

  it("omits the year when includeYear is false, same-month range", () => {
    const cycle = { periodStart: panama(2026, 8, 11), periodEnd: panama(2026, 8, 25) };
    expect(formatCycleRangeText(cycle, { includeYear: false })).toBe("Aug 11–25");
  });

  it("omits the year when includeYear is false, a range spanning a month boundary", () => {
    const cycle = { periodStart: panama(2026, 7, 29), periodEnd: panama(2026, 8, 15) };
    expect(formatCycleRangeText(cycle, { includeYear: false })).toBe("Jul 29 – Aug 15");
  });

  it("omits the year when includeYear is false, a same-day (zero-length) cycle", () => {
    const cycle = { periodStart: panama(2026, 8, 15), periodEnd: panama(2026, 8, 15) };
    expect(formatCycleRangeText(cycle, { includeYear: false })).toBe("Aug 15");
  });

  it("falls back to the calendar-idealized end when periodEnd is null (still-open cycle)", () => {
    const cycle = { periodStart: panama(2026, 8, 1), periodEnd: null };
    expect(formatCycleRangeText(cycle, { includeYear: false })).toBe("Aug 1–15");
  });
});
