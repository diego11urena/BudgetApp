import { describe, expect, it } from "vitest";
import {
  daysUntilSecondPaycheck,
  expectedPaychecksPerCycle,
  expectedSecondPaycheckDate,
} from "./paycheck-schedule";
import { panamaMidnight } from "./pay-date";

describe("expectedPaychecksPerCycle", () => {
  it("expects two only for twice-monthly pay inside a monthly budget", () => {
    expect(expectedPaychecksPerCycle("SEMIMONTHLY", "MONTHLY")).toBe(2);
  });

  it("expects one for every other combination", () => {
    // A quincenal budget IS one pay period.
    expect(expectedPaychecksPerCycle("SEMIMONTHLY", "QUINCENAL")).toBe(1);
    // A once-a-month earner only ever gets one, whatever the cycle length.
    expect(expectedPaychecksPerCycle("MONTHLY", "MONTHLY")).toBe(1);
    expect(expectedPaychecksPerCycle("MONTHLY", "QUINCENAL")).toBe(1);
  });
});

describe("expectedSecondPaycheckDate", () => {
  it("lands on the start of the month's second quincena", () => {
    const monthStart = panamaMidnight(2026, 9, 1);
    expect(expectedSecondPaycheckDate(monthStart, "SEMIMONTHLY", "MONTHLY")).toEqual(
      panamaMidnight(2026, 9, 16),
    );
  });

  it("is null whenever a second paycheck isn't expected at all", () => {
    const monthStart = panamaMidnight(2026, 9, 1);
    expect(expectedSecondPaycheckDate(monthStart, "MONTHLY", "MONTHLY")).toBeNull();
    expect(expectedSecondPaycheckDate(monthStart, "SEMIMONTHLY", "QUINCENAL")).toBeNull();
  });
});

describe("daysUntilSecondPaycheck", () => {
  const monthStart = panamaMidnight(2026, 9, 1);
  const on = (day: number) => panamaMidnight(2026, 9, day);

  it("counts down to the expected date", () => {
    expect(daysUntilSecondPaycheck(on(14), monthStart, "SEMIMONTHLY", "MONTHLY")).toBe(2);
    expect(daysUntilSecondPaycheck(on(15), monthStart, "SEMIMONTHLY", "MONTHLY")).toBe(1);
    expect(daysUntilSecondPaycheck(on(16), monthStart, "SEMIMONTHLY", "MONTHLY")).toBe(0);
  });

  it("collapses an overdue paycheck to 0 rather than going negative", () => {
    // The hero's pace line is about anticipation; a late paycheck is the
    // attention banner's business, not a negative countdown here.
    expect(daysUntilSecondPaycheck(on(20), monthStart, "SEMIMONTHLY", "MONTHLY")).toBe(0);
  });

  it("is null when no second paycheck is expected", () => {
    expect(daysUntilSecondPaycheck(on(14), monthStart, "MONTHLY", "MONTHLY")).toBeNull();
  });
});
