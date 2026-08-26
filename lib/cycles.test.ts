import { describe, expect, it } from "vitest";
import { formatCycleRangeText, latestGoalPerCategory, quincenaForDay, shouldCarryForwardToCycle } from "./cycles";

// Mirrors pay-date.ts's own panamaMidnight anchor (Panama midnight = 05:00
// UTC, since Panama is UTC-5 year-round) -- only needed for the one test
// below that exercises quincenaEnd's calendar fallback (no periodEnd),
// since that path now reads periodStart via Panama's own timezone (see
// lib/quincena-pace.ts); a local `new Date(y, m, d)` input there disagrees
// with the real Panama-anchored value on any test machine outside
// UTC-5/no-DST, e.g. TZ=America/New_York in August (EDT, UTC-4).
function panama(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 5, 0, 0));
}

describe("quincenaForDay", () => {
  it("treats day 1 as the first quincena", () => {
    expect(quincenaForDay(1)).toBe("FIRST");
  });

  it("treats day 15 (the boundary) as the first quincena", () => {
    expect(quincenaForDay(15)).toBe("FIRST");
  });

  it("treats day 16 as the second quincena", () => {
    expect(quincenaForDay(16)).toBe("SECOND");
  });

  it("treats day 31 as the second quincena", () => {
    expect(quincenaForDay(31)).toBe("SECOND");
  });
});

describe("shouldCarryForwardToCycle", () => {
  // PanaPass: fixed amount, BIWEEKLY -> must appear in every single cycle.
  it("PanaPass (BIWEEKLY) carries into a cycle starting in the first quincena", () => {
    const rule = { frequency: "BIWEEKLY" as const, dueDay: null };
    expect(shouldCarryForwardToCycle(rule, new Date(2026, 7, 3))).toBe(true);
  });

  it("PanaPass (BIWEEKLY) carries into a cycle starting in the second quincena too", () => {
    const rule = { frequency: "BIWEEKLY" as const, dueDay: null };
    expect(shouldCarryForwardToCycle(rule, new Date(2026, 7, 20))).toBe(true);
  });

  it("PanaPass (BIWEEKLY) carries in regardless of dueDay being set", () => {
    // Frequency alone decides for BIWEEKLY -- dueDay is a MONTHLY-only concept.
    const rule = { frequency: "BIWEEKLY" as const, dueDay: 5 };
    expect(shouldCarryForwardToCycle(rule, new Date(2026, 7, 20))).toBe(true);
  });

  // Gym: fixed amount, MONTHLY, due near month-end (dueDay 28) -> must show
  // up ONLY in the second quincena of each month, never the first.
  it("Gym (MONTHLY, dueDay 28) does NOT carry into a cycle starting in the first quincena", () => {
    const rule = { frequency: "MONTHLY" as const, dueDay: 28 };
    expect(shouldCarryForwardToCycle(rule, new Date(2026, 7, 3))).toBe(false);
  });

  it("Gym (MONTHLY, dueDay 28) DOES carry into a cycle starting in the second quincena", () => {
    const rule = { frequency: "MONTHLY" as const, dueDay: 28 };
    expect(shouldCarryForwardToCycle(rule, new Date(2026, 7, 20))).toBe(true);
  });

  it("a MONTHLY rule due on the 15th (boundary) carries only into the first quincena", () => {
    const rule = { frequency: "MONTHLY" as const, dueDay: 15 };
    expect(shouldCarryForwardToCycle(rule, new Date(2026, 7, 10))).toBe(true);
    expect(shouldCarryForwardToCycle(rule, new Date(2026, 7, 20))).toBe(false);
  });

  it("a MONTHLY rule due on the 16th carries only into the second quincena", () => {
    const rule = { frequency: "MONTHLY" as const, dueDay: 16 };
    expect(shouldCarryForwardToCycle(rule, new Date(2026, 7, 10))).toBe(false);
    expect(shouldCarryForwardToCycle(rule, new Date(2026, 7, 20))).toBe(true);
  });

  it("a MONTHLY rule with no dueDay set never carries forward (safe default)", () => {
    const rule = { frequency: "MONTHLY" as const, dueDay: null };
    expect(shouldCarryForwardToCycle(rule, new Date(2026, 7, 3))).toBe(false);
    expect(shouldCarryForwardToCycle(rule, new Date(2026, 7, 20))).toBe(false);
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
    const cycle = { periodStart: new Date(2026, 7, 1), periodEnd: new Date(2026, 7, 15) };
    expect(formatCycleRangeText(cycle)).toBe("Aug 1–15, 2026");
  });

  it("omits the year when includeYear is false, same-month range", () => {
    const cycle = { periodStart: new Date(2026, 7, 11), periodEnd: new Date(2026, 7, 25) };
    expect(formatCycleRangeText(cycle, { includeYear: false })).toBe("Aug 11–25");
  });

  it("omits the year when includeYear is false, a range spanning a month boundary", () => {
    const cycle = { periodStart: new Date(2026, 6, 29), periodEnd: new Date(2026, 7, 15) };
    expect(formatCycleRangeText(cycle, { includeYear: false })).toBe("Jul 29 – Aug 15");
  });

  it("omits the year when includeYear is false, a same-day (zero-length) cycle", () => {
    const cycle = { periodStart: new Date(2026, 7, 15), periodEnd: new Date(2026, 7, 15) };
    expect(formatCycleRangeText(cycle, { includeYear: false })).toBe("Aug 15");
  });

  it("falls back to the calendar-idealized end when periodEnd is null (still-open cycle)", () => {
    const cycle = { periodStart: panama(2026, 8, 1), periodEnd: null };
    expect(formatCycleRangeText(cycle, { includeYear: false })).toBe("Aug 1–15");
  });
});
