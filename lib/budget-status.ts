export type BudgetStatus = "good" | "warning" | "critical";

export interface BudgetUsage {
  state: BudgetStatus;
  /** Uncapped — can exceed 100 so the displayed number reflects reality even when over. */
  percentage: number;
  /** > 0 whenever spending has actually passed the target, regardless of which color tier that lands in. */
  overBy: number;
}

/** At or under this percent of target is "good" -- hitting a target exactly is the intended outcome, not a warning. */
export const BUDGET_GOOD_MAX_PERCENT = 100;
/** Above BUDGET_GOOD_MAX_PERCENT and at or under this is "warning" (over, not seriously); above this is "critical". */
export const BUDGET_WARNING_MAX_PERCENT = 120;

/**
 * 0–100% of budget is "good" (including exactly on target), 101–120% is
 * "warning", over 120% is "critical" -- named thresholds so every
 * percent-of-target bar in the app (see ProgressBar.tsx's own fallback)
 * can share these instead of each defining its own cutoffs. No budget set
 * at all (target <= 0) is treated as fully over once anything's been spent
 * against it -- there's no percentage that makes sense to compute, so it
 * goes straight to "critical" rather than trying to fit the tiers above.
 */
export function getBudgetUsage(spent: number, budget: number): BudgetUsage {
  if (budget <= 0) {
    return spent > 0
      ? { state: "critical", percentage: 100, overBy: spent }
      : { state: "good", percentage: 0, overBy: 0 };
  }

  const rawPercentage = (spent / budget) * 100;
  const percentage = Math.round(rawPercentage);
  const overBy = rawPercentage > BUDGET_GOOD_MAX_PERCENT ? spent - budget : 0;

  if (rawPercentage > BUDGET_WARNING_MAX_PERCENT) {
    return { state: "critical", percentage, overBy };
  }
  if (rawPercentage > BUDGET_GOOD_MAX_PERCENT) {
    return { state: "warning", percentage, overBy };
  }
  return { state: "good", percentage, overBy: 0 };
}
