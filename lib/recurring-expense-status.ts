import { getBudgetUsage } from "./budget-status";

/** A Scheduled item's payment status this cycle -- meaningless for an Ongoing item, which has no target to be partial/over/under against (see OngoingRecurringExpenseStatus). */
export type ScheduledRecurringExpenseStatus = "not-started" | "partial" | "paid" | "paid-over" | "exceeded";

/** An Ongoing item's status this cycle -- no target amount to compare against (its own amount is a typical/estimated one, not an exact one to hit), so "how much" doesn't apply the way it does for a Scheduled item. Just whether at least one payment has been logged. */
export type OngoingRecurringExpenseStatus = "logged" | "not-logged";

/** @deprecated Use ScheduledRecurringExpenseStatus or OngoingRecurringExpenseStatus directly -- kept as their union for call sites that only need "some status string," not the ability to distinguish which kind. */
export type RecurringExpensePaymentStatus = ScheduledRecurringExpenseStatus | OngoingRecurringExpenseStatus;

/**
 * A Scheduled recurring expense's payment status this cycle -- a
 * different framing than lib/budget-status.ts's category-level good/
 * warning/critical (percent used against a budget), but mapped 1:1 onto
 * those same three tiers so the two levels can never visually disagree:
 * a category showing its warning-orange bar always has at least one item
 * inside also flagged as "paid-over," never a calm green "Paid" hiding
 * the reason for the warning. good+under target = partial, good+at target
 * = paid, warning = paid-over, critical = exceeded.
 */
export function getRecurringExpensePaymentStatus(actual: number, target: number): ScheduledRecurringExpenseStatus {
  if (actual <= 0) return "not-started";
  const usage = getBudgetUsage(actual, target);
  if (usage.state === "critical") return "exceeded";
  if (usage.state === "warning") return "paid-over";
  if (actual < target) return "partial";
  return "paid";
}

/**
 * An Ongoing item's status this cycle -- deliberately not a percent-of-
 * target comparison (see OngoingRecurringExpenseStatus's own doc comment):
 * its amount is a typical/estimated one, so "paid-over" or "exceeded"
 * would read as an alarm over nothing more than a guess being a little
 * off. Just whether any payment has landed yet.
 */
export function getOngoingRecurringExpenseStatus(actual: number): OngoingRecurringExpenseStatus {
  return actual > 0 ? "logged" : "not-logged";
}
