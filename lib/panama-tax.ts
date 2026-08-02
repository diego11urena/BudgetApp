import Decimal from "decimal.js";

export type { Decimal };

/**
 * Panama payroll and personal income tax calculations.
 *
 * Salaries are quoted/contracted monthly in Panama, even though pay is
 * disbursed quincenally (twice a month). This module computes deductions on
 * the monthly basis (matching how a payslip would itemize it), then derives
 * the quincena split — CSS and Seguro Educativo are flat percentages, so
 * halving the monthly deduction is exact; ISR is annualized over 12 months
 * as usual, so the quincena ISR is simply half the monthly ISR too.
 *
 * Every `BudgetCycle` is one quincena, so callers should store the
 * `quincena*` fields on `CycleIncomeEntry`, never the monthly ones.
 *
 * Simplifications (documented, not hidden):
 * - ISR is legally an annual tax with DGI-published monthly withholding
 *   tables. Here monthly withholding is approximated as
 *   calculateISR(gross * 12) / 12.
 * - Décimo Tercer Mes is not auto-calculated — the user logs it manually as
 *   a one-off income transaction when they receive it (the existing "Add
 *   Income" flow already supports this with no further changes needed).
 */

const CSS_RATE = new Decimal("0.0975");
const SEGURO_EDUCATIVO_RATE = new Decimal("0.0125");

const ISR_EXEMPT_CEILING = new Decimal("11000");
const ISR_MID_CEILING = new Decimal("50000");
const ISR_MID_RATE = new Decimal("0.15");
const ISR_TOP_RATE = new Decimal("0.25");
const ISR_TOP_FIXED_BASE = new Decimal("5850");

function toDecimal(value: Decimal.Value): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

/** Employee CSS (social security) deduction: 9.75% of gross. */
export function calculateCSS(grossAmount: Decimal.Value): Decimal {
  return toDecimal(grossAmount).times(CSS_RATE).toDecimalPlaces(2);
}

/** Employee Seguro Educativo deduction: 1.25% of gross. */
export function calculateSeguroEducativo(grossAmount: Decimal.Value): Decimal {
  return toDecimal(grossAmount).times(SEGURO_EDUCATIVO_RATE).toDecimalPlaces(2);
}

/** Panama ISR (income tax) on an annual taxable income, per the bracket schedule. */
export function calculateISR(annualTaxableIncome: Decimal.Value): Decimal {
  const income = toDecimal(annualTaxableIncome);

  if (income.lessThanOrEqualTo(ISR_EXEMPT_CEILING)) {
    return new Decimal(0).toDecimalPlaces(2);
  }

  if (income.lessThanOrEqualTo(ISR_MID_CEILING)) {
    return income
      .minus(ISR_EXEMPT_CEILING)
      .times(ISR_MID_RATE)
      .toDecimalPlaces(2);
  }

  return income
    .minus(ISR_MID_CEILING)
    .times(ISR_TOP_RATE)
    .plus(ISR_TOP_FIXED_BASE)
    .toDecimalPlaces(2);
}

export interface ComputeNetIncomeInput {
  grossMonthlyAmount: Decimal.Value;
  isPanamaPayroll: boolean;
}

export interface ComputeNetIncomeResult {
  // Monthly reference — matches how the salary is actually quoted/contracted.
  grossMonthlyAmount: Decimal;
  monthlyCssDeduction: Decimal;
  monthlySeguroEducativoDeduction: Decimal;
  monthlyIsrDeduction: Decimal;
  netMonthlyAmount: Decimal;

  // What actually gets stored per BudgetCycle — one quincena = half of monthly.
  grossQuincenaAmount: Decimal;
  quincenaCssDeduction: Decimal;
  quincenaSeguroEducativoDeduction: Decimal;
  quincenaIsrDeduction: Decimal;
  netQuincenaAmount: Decimal;
}

/** Full monthly + quincena breakdown for a given monthly gross salary. */
export function computeNetIncomeForCycle(
  input: ComputeNetIncomeInput,
): ComputeNetIncomeResult {
  const monthlyGross = toDecimal(input.grossMonthlyAmount).toDecimalPlaces(2);

  if (!input.isPanamaPayroll) {
    const half = monthlyGross.dividedBy(2).toDecimalPlaces(2);
    return {
      grossMonthlyAmount: monthlyGross,
      monthlyCssDeduction: new Decimal(0),
      monthlySeguroEducativoDeduction: new Decimal(0),
      monthlyIsrDeduction: new Decimal(0),
      netMonthlyAmount: monthlyGross,
      grossQuincenaAmount: half,
      quincenaCssDeduction: new Decimal(0),
      quincenaSeguroEducativoDeduction: new Decimal(0),
      quincenaIsrDeduction: new Decimal(0),
      netQuincenaAmount: half,
    };
  }

  const monthlyCssDeduction = calculateCSS(monthlyGross);
  const monthlySeguroEducativoDeduction = calculateSeguroEducativo(monthlyGross);
  const isrAnnual = calculateISR(monthlyGross.times(12));
  const monthlyIsrDeduction = isrAnnual.dividedBy(12).toDecimalPlaces(2);

  const netMonthlyAmount = monthlyGross
    .minus(monthlyCssDeduction)
    .minus(monthlySeguroEducativoDeduction)
    .minus(monthlyIsrDeduction)
    .toDecimalPlaces(2);

  return {
    grossMonthlyAmount: monthlyGross,
    monthlyCssDeduction,
    monthlySeguroEducativoDeduction,
    monthlyIsrDeduction,
    netMonthlyAmount,
    grossQuincenaAmount: monthlyGross.dividedBy(2).toDecimalPlaces(2),
    quincenaCssDeduction: monthlyCssDeduction.dividedBy(2).toDecimalPlaces(2),
    quincenaSeguroEducativoDeduction: monthlySeguroEducativoDeduction
      .dividedBy(2)
      .toDecimalPlaces(2),
    quincenaIsrDeduction: monthlyIsrDeduction.dividedBy(2).toDecimalPlaces(2),
    netQuincenaAmount: netMonthlyAmount.dividedBy(2).toDecimalPlaces(2),
  };
}
