import Decimal from "decimal.js";

export type { Decimal };

/**
 * Panama payroll and personal income tax calculations.
 *
 * Simplifications (documented, not hidden):
 * - ISR is legally an annual tax with DGI-published monthly withholding tables.
 *   Here monthly withholding is approximated as calculateISR(gross * 12) / 12.
 * - ISR is not withheld from décimo in this model (Panama's real rules route
 *   décimo through the annual declaration rather than monthly withholding).
 * - A cycle's décimo estimate falls back to `grossMonthlyAmount / 3` when there
 *   isn't 4 months of trailing salary history yet (e.g. a user's first cycle).
 */

const CSS_RATE = new Decimal("0.0975");
const CSS_DECIMO_RATE = new Decimal("0.0725");
const SEGURO_EDUCATIVO_RATE = new Decimal("0.0125");

const ISR_EXEMPT_CEILING = new Decimal("11000");
const ISR_MID_CEILING = new Decimal("50000");
const ISR_MID_RATE = new Decimal("0.15");
const ISR_TOP_RATE = new Decimal("0.25");
const ISR_TOP_FIXED_BASE = new Decimal("5850");

const DECIMO_MONTHS = new Set([4, 8, 12]);

function toDecimal(value: Decimal.Value): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

/** Employee CSS (social security) deduction. 9.75% normally, 7.25% on the décimo portion. */
export function calculateCSS(
  grossAmount: Decimal.Value,
  isDecimoPortion = false,
): Decimal {
  const rate = isDecimoPortion ? CSS_DECIMO_RATE : CSS_RATE;
  return toDecimal(grossAmount).times(rate).toDecimalPlaces(2);
}

/** Employee Seguro Educativo deduction. 1.25% normally, not deducted from décimo. */
export function calculateSeguroEducativo(
  grossAmount: Decimal.Value,
  isDecimoPortion = false,
): Decimal {
  if (isDecimoPortion) return new Decimal(0);
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

/** Décimo Tercer Mes installment: sum of the period's salaries divided by 12. */
export function calculateDecimoInstallment(
  trailingFourMonthSalaries: Decimal.Value[],
): Decimal {
  const sum = trailingFourMonthSalaries.reduce(
    (acc: Decimal, salary) => acc.plus(toDecimal(salary)),
    new Decimal(0),
  );
  return sum.dividedBy(12).toDecimalPlaces(2);
}

/** Estimated décimo installment when there's no salary history yet (e.g. onboarding). */
export function estimateFirstCycleDecimo(
  grossMonthlyAmount: Decimal.Value,
): Decimal {
  return toDecimal(grossMonthlyAmount).dividedBy(3).toDecimalPlaces(2);
}

/** Whether the given calendar month (1-12) is a décimo payment month (Apr/Aug/Dec). */
export function isDecimoMonth(month: number): boolean {
  return DECIMO_MONTHS.has(month);
}

export interface DecimoScheduleEntry {
  month: number;
  paymentDate: string; // YYYY-MM-DD
  periodLabel: string;
}

/** The 3 décimo payment dates for a given year and the periods they cover. */
export function getDecimoScheduleForYear(year: number): DecimoScheduleEntry[] {
  return [
    { month: 4, paymentDate: `${year}-04-15`, periodLabel: `${year - 1}-12 to ${year}-03` },
    { month: 8, paymentDate: `${year}-08-15`, periodLabel: `${year}-04 to ${year}-07` },
    { month: 12, paymentDate: `${year}-12-15`, periodLabel: `${year}-08 to ${year}-11` },
  ];
}

export interface ComputeNetIncomeInput {
  grossMonthlyAmount: Decimal.Value;
  cycleMonth: number; // 1-12
  isPanamaPayroll: boolean;
  trailingFourMonthSalaries?: Decimal.Value[];
}

export interface ComputeNetIncomeResult {
  grossAmount: Decimal;
  cssDeduction: Decimal;
  seguroEducativoDeduction: Decimal;
  isrDeduction: Decimal;
  decimoGrossAmount: Decimal | null;
  decimoCssDeduction: Decimal | null;
  decimoIsEstimated: boolean;
  netAmount: Decimal;
}

/** Full breakdown of a cycle's income entry, including décimo if the cycle month applies. */
export function computeNetIncomeForCycle(
  input: ComputeNetIncomeInput,
): ComputeNetIncomeResult {
  const gross = toDecimal(input.grossMonthlyAmount);

  if (!input.isPanamaPayroll) {
    return {
      grossAmount: gross.toDecimalPlaces(2),
      cssDeduction: new Decimal(0),
      seguroEducativoDeduction: new Decimal(0),
      isrDeduction: new Decimal(0),
      decimoGrossAmount: null,
      decimoCssDeduction: null,
      decimoIsEstimated: false,
      netAmount: gross.toDecimalPlaces(2),
    };
  }

  const cssDeduction = calculateCSS(gross);
  const seguroEducativoDeduction = calculateSeguroEducativo(gross);
  const isrAnnual = calculateISR(gross.times(12));
  const isrDeduction = isrAnnual.dividedBy(12).toDecimalPlaces(2);

  let decimoGrossAmount: Decimal | null = null;
  let decimoCssDeduction: Decimal | null = null;
  let decimoIsEstimated = false;

  if (isDecimoMonth(input.cycleMonth)) {
    const history = input.trailingFourMonthSalaries;
    if (history && history.length >= 4) {
      decimoGrossAmount = calculateDecimoInstallment(history);
    } else {
      decimoGrossAmount = estimateFirstCycleDecimo(gross);
      decimoIsEstimated = true;
    }
    decimoCssDeduction = calculateCSS(decimoGrossAmount, true);
  }

  let netAmount = gross
    .minus(cssDeduction)
    .minus(seguroEducativoDeduction)
    .minus(isrDeduction);

  if (decimoGrossAmount && decimoCssDeduction) {
    netAmount = netAmount.plus(decimoGrossAmount).minus(decimoCssDeduction);
  }

  return {
    grossAmount: gross.toDecimalPlaces(2),
    cssDeduction,
    seguroEducativoDeduction,
    isrDeduction,
    decimoGrossAmount,
    decimoCssDeduction,
    decimoIsEstimated,
    netAmount: netAmount.toDecimalPlaces(2),
  };
}
