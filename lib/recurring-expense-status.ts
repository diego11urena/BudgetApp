import { getBudgetUsage } from "./budget-status";

export type RecurringExpensePaymentStatus = "not-started" | "partial" | "paid" | "exceeded";

/**
 * An individual recurring expense's payment status this cycle -- a
 * different framing than lib/budget-status.ts's category-level good/
 * warning/critical (percent used against a budget), but built on the same
 * underlying thresholds so "over 120%" means the same thing everywhere in
 * the app. Green = paid, neutral = not started, an intermediate state for
 * partially paid, red only for an actual problem (exceeded).
 */
export function getRecurringExpensePaymentStatus(actual: number, target: number): RecurringExpensePaymentStatus {
  if (actual <= 0) return "not-started";
  const usage = getBudgetUsage(actual, target);
  if (usage.state === "critical") return "exceeded";
  if (actual < target) return "partial";
  return "paid";
}
