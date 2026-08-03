export type BudgetStatus = "good" | "warning" | "critical";

export interface BudgetUsage {
  state: BudgetStatus;
  /** Uncapped — can exceed 100 so the displayed number reflects reality even when over. */
  percentage: number;
  /** > 0 only when state is "critical". */
  overBy: number;
}

const WARNING_THRESHOLD = 85;

/**
 * Under 85% of budget is "good", 85–100% is "warning", over 100% is
 * "critical" with the overage amount. No budget set at all (target <= 0)
 * is treated as fully over once anything's been spent against it.
 */
export function getBudgetUsage(spent: number, budget: number): BudgetUsage {
  if (budget <= 0) {
    return spent > 0
      ? { state: "critical", percentage: 100, overBy: spent }
      : { state: "good", percentage: 0, overBy: 0 };
  }

  const rawPercentage = (spent / budget) * 100;
  const percentage = Math.round(rawPercentage);

  if (rawPercentage > 100) {
    return { state: "critical", percentage, overBy: spent - budget };
  }
  if (rawPercentage >= WARNING_THRESHOLD) {
    return { state: "warning", percentage, overBy: 0 };
  }
  return { state: "good", percentage, overBy: 0 };
}
