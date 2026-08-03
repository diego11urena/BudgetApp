import { describe, expect, it } from "vitest";
import { formatCycleLabel, quincenaForDay, shouldCarryForwardToCycle } from "./cycles";

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
