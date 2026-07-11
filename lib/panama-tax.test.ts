import { describe, expect, it } from "vitest";
import {
  calculateCSS,
  calculateISR,
  calculateSeguroEducativo,
  computeNetIncomeForCycle,
  isDecimoMonth,
} from "./panama-tax";

describe("calculateISR", () => {
  it("is exempt at and below the $11,000 ceiling", () => {
    expect(calculateISR(11000).toNumber()).toBe(0);
    expect(calculateISR(5000).toNumber()).toBe(0);
  });

  it("applies 15% over $11,000 in the middle bracket", () => {
    expect(calculateISR(11001).toNumber()).toBeCloseTo(0.15, 2);
    expect(calculateISR(50000).toNumber()).toBeCloseTo(5850, 2);
  });

  it("applies 25% over $50,000 plus the $5,850 fixed base", () => {
    expect(calculateISR(50001).toNumber()).toBeCloseTo(5850.25, 2);
    expect(calculateISR(60000).toNumber()).toBeCloseTo(8350, 2);
  });
});

describe("calculateCSS", () => {
  it("deducts 9.75% normally", () => {
    expect(calculateCSS(1000).toNumber()).toBeCloseTo(97.5, 2);
  });

  it("deducts 7.25% on the décimo portion", () => {
    expect(calculateCSS(1000, true).toNumber()).toBeCloseTo(72.5, 2);
  });
});

describe("calculateSeguroEducativo", () => {
  it("deducts 1.25% normally", () => {
    expect(calculateSeguroEducativo(1000).toNumber()).toBeCloseTo(12.5, 2);
  });

  it("deducts nothing on the décimo portion", () => {
    expect(calculateSeguroEducativo(1000, true).toNumber()).toBe(0);
  });
});

describe("isDecimoMonth", () => {
  it("is true only for April, August, and December", () => {
    expect(isDecimoMonth(4)).toBe(true);
    expect(isDecimoMonth(8)).toBe(true);
    expect(isDecimoMonth(12)).toBe(true);
    expect(isDecimoMonth(1)).toBe(false);
    expect(isDecimoMonth(7)).toBe(false);
  });
});

describe("computeNetIncomeForCycle", () => {
  it("computes CSS/SE/ISR and net for a non-décimo month", () => {
    const result = computeNetIncomeForCycle({
      grossMonthlyAmount: 2000,
      cycleMonth: 1,
      isPanamaPayroll: true,
    });

    expect(result.cssDeduction.toNumber()).toBeCloseTo(195, 2);
    expect(result.seguroEducativoDeduction.toNumber()).toBeCloseTo(25, 2);
    expect(result.decimoGrossAmount).toBeNull();
    expect(result.decimoCssDeduction).toBeNull();
    expect(result.decimoIsEstimated).toBe(false);
    expect(result.regularNetAmount.toNumber()).toBeCloseTo(1617.5, 2);
    expect(result.biweeklyNetAmount.toNumber()).toBeCloseTo(808.75, 2);
  });

  it("estimates décimo as gross/3 in a décimo month with no salary history", () => {
    const result = computeNetIncomeForCycle({
      grossMonthlyAmount: 2000,
      cycleMonth: 4,
      isPanamaPayroll: true,
    });

    expect(result.decimoIsEstimated).toBe(true);
    expect(result.decimoGrossAmount?.toNumber()).toBeCloseTo(666.67, 2);
    expect(result.decimoCssDeduction?.toNumber()).toBeCloseTo(48.33, 2);
    // Décimo is a lump sum, not part of the recurring biweekly paycheck.
    expect(result.biweeklyNetAmount.toNumber()).toBeCloseTo(808.75, 2);
  });

  it("uses real trailing salary history when available in a décimo month", () => {
    const result = computeNetIncomeForCycle({
      grossMonthlyAmount: 2000,
      cycleMonth: 8,
      isPanamaPayroll: true,
      trailingFourMonthSalaries: [2000, 2000, 2000, 2000],
    });

    expect(result.decimoIsEstimated).toBe(false);
    expect(result.decimoGrossAmount?.toNumber()).toBeCloseTo(666.67, 2);
  });

  it("skips all Panama deductions for non-Panama income sources", () => {
    const result = computeNetIncomeForCycle({
      grossMonthlyAmount: 2000,
      cycleMonth: 4,
      isPanamaPayroll: false,
    });

    expect(result.cssDeduction.toNumber()).toBe(0);
    expect(result.seguroEducativoDeduction.toNumber()).toBe(0);
    expect(result.isrDeduction.toNumber()).toBe(0);
    expect(result.decimoGrossAmount).toBeNull();
    expect(result.netAmount.toNumber()).toBe(2000);
  });
});
