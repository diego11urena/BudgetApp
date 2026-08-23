import { getBudgetUsage } from "./budget-status";

export type RecurringExpensePaymentStatus = "not-started" | "partial" | "paid" | "paid-over" | "exceeded";

/**
 * An individual recurring expense's payment status this cycle -- a
 * different framing than lib/budget-status.ts's category-level good/
 * warning/critical (percent used against a budget), but mapped 1:1 onto
 * those same three tiers so the two levels can never visually disagree:
 * a category showing its warning-orange bar always has at least one item
 * inside also flagged as "paid-over," never a calm green "Paid" hiding
 * the reason for the warning. good+under target = partial, good+at target
 * = paid, warning = paid-over, critical = exceeded.
 */
export function getRecurringExpensePaymentStatus(actual: number, target: number): RecurringExpensePaymentStatus {
  if (actual <= 0) return "not-started";
  const usage = getBudgetUsage(actual, target);
  if (usage.state === "critical") return "exceeded";
  if (usage.state === "warning") return "paid-over";
  if (actual < target) return "partial";
  return "paid";
}
