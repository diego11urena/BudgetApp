import Decimal from "decimal.js";

export type { Decimal };

/**
 * Panama payroll and personal income tax calculations.
 *
 * The app works entirely in quincenas (15-day pay cycles) — every
 * `BudgetCycle` is one pay period, not a calendar month. Gross amounts here
 * are always "per cycle," and ISR is annualized as 24 cycles/year.
 *
 * Simplifications (documented, not hidden):
 * - ISR is legally an annual tax with DGI-published per-period withholding
 *   tables. Here per-cycle withholding is approximated as
 *   calculateISR(gross * 24) / 24.
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

const CYCLES_PER_YEAR = 24;

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
  grossAmountPerCycle: Decimal.Value;
  isPanamaPayroll: boolean;
}

export interface ComputeNetIncomeResult {
  grossAmount: Decimal;
  cssDeduction: Decimal;
  seguroEducativoDeduction: Decimal;
  isrDeduction: Decimal;
  netAmount: Decimal;
}

/** Full breakdown of one cycle's (quincena) income. */
export function computeNetIncomeForCycle(
  input: ComputeNetIncomeInput,
): ComputeNetIncomeResult {
  const gross = toDecimal(input.grossAmountPerCycle);

  if (!input.isPanamaPayroll) {
    const flatNet = gross.toDecimalPlaces(2);
    return {
      grossAmount: flatNet,
      cssDeduction: new Decimal(0),
      seguroEducativoDeduction: new Decimal(0),
      isrDeduction: new Decimal(0),
      netAmount: flatNet,
    };
  }

  const cssDeduction = calculateCSS(gross);
  const seguroEducativoDeduction = calculateSeguroEducativo(gross);
  const isrAnnual = calculateISR(gross.times(CYCLES_PER_YEAR));
  const isrDeduction = isrAnnual.dividedBy(CYCLES_PER_YEAR).toDecimalPlaces(2);

  const netAmount = gross
    .minus(cssDeduction)
    .minus(seguroEducativoDeduction)
    .minus(isrDeduction)
    .toDecimalPlaces(2);

  return {
    grossAmount: gross.toDecimalPlaces(2),
    cssDeduction,
    seguroEducativoDeduction,
    isrDeduction,
    netAmount,
  };
}
