import { describe, expect, it } from "vitest";
import { calculateCSS, calculateISR, calculateSeguroEducativo, computeNetIncomeForCycle } from "./panama-tax";

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
  it("deducts 9.75% of gross", () => {
    expect(calculateCSS(1000).toNumber()).toBeCloseTo(97.5, 2);
  });
});

describe("calculateSeguroEducativo", () => {
  it("deducts 1.25% of gross", () => {
    expect(calculateSeguroEducativo(1000).toNumber()).toBeCloseTo(12.5, 2);
  });
});

describe("computeNetIncomeForCycle", () => {
  it("computes the monthly breakdown and its exact quincena half", () => {
    // $2000/month -> $24,000/year, in the 15% ISR bracket.
    const result = computeNetIncomeForCycle({
      grossMonthlyAmount: 2000,
      isPanamaPayroll: true,
    });

    expect(result.grossMonthlyAmount.toNumber()).toBeCloseTo(2000, 2);
    expect(result.monthlyCssDeduction.toNumber()).toBeCloseTo(195, 2);
    expect(result.monthlySeguroEducativoDeduction.toNumber()).toBeCloseTo(25, 2);
    // annual = 24000, ISR = (24000-11000)*0.15 = 1950, monthly = 1950/12
    expect(result.monthlyIsrDeduction.toNumber()).toBeCloseTo(162.5, 2);
    expect(result.netMonthlyAmount.toNumber()).toBeCloseTo(1617.5, 2);

    // Quincena = exactly half of every monthly figure.
    expect(result.grossQuincenaAmount.toNumber()).toBeCloseTo(1000, 2);
    expect(result.quincenaCssDeduction.toNumber()).toBeCloseTo(97.5, 2);
    expect(result.quincenaSeguroEducativoDeduction.toNumber()).toBeCloseTo(12.5, 2);
    expect(result.quincenaIsrDeduction.toNumber()).toBeCloseTo(81.25, 2);
    expect(result.netQuincenaAmount.toNumber()).toBeCloseTo(808.75, 2);
  });

  it("skips all Panama deductions for non-Panama income sources", () => {
    const result = computeNetIncomeForCycle({
      grossMonthlyAmount: 2000,
      isPanamaPayroll: false,
    });

    expect(result.monthlyCssDeduction.toNumber()).toBe(0);
    expect(result.monthlySeguroEducativoDeduction.toNumber()).toBe(0);
    expect(result.monthlyIsrDeduction.toNumber()).toBe(0);
    expect(result.netMonthlyAmount.toNumber()).toBe(2000);
    expect(result.netQuincenaAmount.toNumber()).toBe(1000);
  });
});
