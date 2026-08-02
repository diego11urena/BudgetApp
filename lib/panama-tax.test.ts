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
  it("computes CSS/SE/ISR and net for one quincena cycle", () => {
    // $2000 gross per cycle -> $48,000/year (24 cycles), squarely in the
    // 15% ISR bracket.
    const result = computeNetIncomeForCycle({
      grossAmountPerCycle: 2000,
      isPanamaPayroll: true,
    });

    expect(result.grossAmount.toNumber()).toBeCloseTo(2000, 2);
    expect(result.cssDeduction.toNumber()).toBeCloseTo(195, 2);
    expect(result.seguroEducativoDeduction.toNumber()).toBeCloseTo(25, 2);
    // annual = 48000, ISR = (48000-11000)*0.15 = 5550, per cycle = 5550/24
    expect(result.isrDeduction.toNumber()).toBeCloseTo(231.25, 2);
    expect(result.netAmount.toNumber()).toBeCloseTo(1548.75, 2);
  });

  it("skips all Panama deductions for non-Panama income sources", () => {
    const result = computeNetIncomeForCycle({
      grossAmountPerCycle: 2000,
      isPanamaPayroll: false,
    });

    expect(result.cssDeduction.toNumber()).toBe(0);
    expect(result.seguroEducativoDeduction.toNumber()).toBe(0);
    expect(result.isrDeduction.toNumber()).toBe(0);
    expect(result.netAmount.toNumber()).toBe(2000);
  });
});
