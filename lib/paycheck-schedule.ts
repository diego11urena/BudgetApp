import type { IncomeFrequency } from "@/app/generated/prisma/client";
import type { BudgetFrequency } from "./quincena-pace";
import { nextQuincenaStart } from "./quincena-pace";
import { calendarDaysBetween } from "./quincena-pace";

/**
 * How many paychecks a single budget cycle is expected to receive.
 *
 * This is the pay x budget matrix from the design spec, and the only
 * combination that yields two is twice-monthly pay inside a monthly
 * budget: the cycle is a calendar month, and the earner is paid at the
 * middle and the end of it. Every other combination is one paycheck per
 * cycle -- a quincenal budget IS one pay period, and a once-a-month
 * earner only ever gets one regardless of cycle length.
 *
 * Worth stating plainly because the whole Home hero for monthly budgeters
 * keys off it: with two expected, "I just got paid" ADDS a paycheck and
 * the month stays open until the user closes it; with one, there is
 * nothing to add and the only action is closing.
 */
export function expectedPaychecksPerCycle(
  payFrequency: IncomeFrequency,
  budgetFrequency: BudgetFrequency,
): 1 | 2 {
  return budgetFrequency === "MONTHLY" && payFrequency === "SEMIMONTHLY" ? 2 : 1;
}

/**
 * When the second paycheck of a monthly cycle is expected -- the start of
 * the month's second quincena, which is the same boundary the quincenal
 * cadence already uses, so a user who switches budget frequency doesn't
 * see their pay dates move.
 *
 * Null whenever a second paycheck isn't expected at all, so callers can
 * treat "no date" and "not applicable" as one case.
 */
export function expectedSecondPaycheckDate(
  periodStart: Date,
  payFrequency: IncomeFrequency,
  budgetFrequency: BudgetFrequency,
): Date | null {
  if (expectedPaychecksPerCycle(payFrequency, budgetFrequency) !== 2) return null;
  return nextQuincenaStart(periodStart);
}

/**
 * Days until the second paycheck, for the hero's pace line. The spec is
 * explicit that this is a COUNTDOWN in days rather than a date ("2nd
 * paycheck expected in 2 days"), with "tomorrow" at 1 and "today" at 0 --
 * a date would make the reader do the subtraction themselves, which is
 * the one thing the line exists to save them.
 *
 * Negative (the expected date has passed without a paycheck being logged)
 * collapses to 0: "expected today" is the honest reading of an overdue
 * paycheck in a line whose job is anticipation, not a late warning --
 * that is the attention banner's job, not the hero's.
 */
export function daysUntilSecondPaycheck(
  now: Date,
  periodStart: Date,
  payFrequency: IncomeFrequency,
  budgetFrequency: BudgetFrequency,
): number | null {
  const expected = expectedSecondPaycheckDate(periodStart, payFrequency, budgetFrequency);
  if (expected === null) return null;
  return Math.max(0, calendarDaysBetween(now, expected));
}
