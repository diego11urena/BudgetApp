import type { CycleFinancials } from "./cycle-financials";
import type { GoalWithProgress } from "./goals";
import { computeSavedSoFar } from "./goals";

/** Series point for the 6-period sparkline — label + spent amount. */
export interface SparklinePoint {
  label: string;
  spent: number;
}

/**
 * Spend comparison against a baseline (e.g. "your last three quincenas").
 * Degrades to nulls when insufficient history exists (< 2 prior periods).
 */
export interface SpendComparison {
  deltaAmount: number;
  isLighter: boolean; // true = current is lower
  label: "lightest" | "heaviest" | null; // "lightest since {month}" or null
  /**
   * The historical cycle's periodStart backing `label` -- a raw Date, not
   * a pre-formatted string, since this app's convention is that
   * locale-dependent formatting happens client-side (see
   * lib/format.ts's formatMonthLabel). Null whenever `label` is null.
   */
  sincePeriodStart: Date | null;
}

/** Goal rows classified for Summary (completed vs. in-progress). */
export interface ClassifiedGoals {
  completed: GoalWithProgress[];
  inProgress: (GoalWithProgress & {
    contributionThisCycle: number;
    percentOfTarget: number;
  })[];
}

/** Uncategorized transaction warning (if any). */
export interface UncategorizedWarning {
  count: number;
  totalAmount: number;
}

/**
 * Sparkline data: transforms last N cycles into {label, spent}[] for rendering.
 * No lower bound — renders with whatever periods exist (1 point = just dot, no line).
 */
export function computeSparklineSeries(
  cycles: { financials: CycleFinancials; periodLabel?: string }[]
): SparklinePoint[] {
  return cycles.map((cycle) => ({
    label: cycle.periodLabel ?? "",
    spent: cycle.financials.totalExpenses,
  }));
}

/**
 * Spend comparison: "$47 less than your last three quincenas — your lightest since May."
 * Requires recentSpends (trailing N prior periods), and scans further back in history
 * (allHistoricalSpends, paired with each period's own periodStart) for the
 * "lightest/heaviest since" context.
 *
 * Degrades: returns all-null when recentSpends.length < 2 (insufficient history).
 */
export function computeSpendComparison(
  current: number,
  recentSpends: number[],
  allHistoricalSpends?: { amount: number; periodStart: Date }[]
): Partial<SpendComparison> | null {
  if (recentSpends.length < 2) {
    return null; // Insufficient data — omit subcopy entirely.
  }

  const avgRecent = recentSpends.reduce((a, b) => a + b, 0) / recentSpends.length;
  const deltaAmount = Math.round((avgRecent - current) * 100) / 100;
  const isLighter = current < avgRecent;

  // "Lightest/heaviest since..." requires full history scan.
  let label: "lightest" | "heaviest" | null = null;
  let sincePeriodStart: Date | null = null;

  if (allHistoricalSpends && allHistoricalSpends.length > 0) {
    // The single lightest/heaviest historical entry -- its own periodStart
    // is what "since {month}" refers to, not just the bare min/max amount.
    const minEntry = allHistoricalSpends.reduce((min, entry) => (entry.amount < min.amount ? entry : min));
    const maxEntry = allHistoricalSpends.reduce((max, entry) => (entry.amount > max.amount ? entry : max));

    if (current <= minEntry.amount && current < avgRecent) {
      label = "lightest";
      sincePeriodStart = minEntry.periodStart;
    } else if (current >= maxEntry.amount && current > avgRecent) {
      label = "heaviest";
      sincePeriodStart = maxEntry.periodStart;
    }
  }

  return { deltaAmount, isLighter, label, sincePeriodStart };
}

/**
 * Classify goals into completed (target reached) and in-progress (with contribution
 * and % of target this cycle). Completed = savedSoFar >= lifetimeTargetAmount AND
 * lifetimeTargetAmount > 0 (i.e., flagged as a goal, not just a savings category).
 */
export function classifyGoalRowsForSummary(
  goals: GoalWithProgress[]
): ClassifiedGoals {
  const completed: GoalWithProgress[] = [];
  const inProgress: (GoalWithProgress & {
    contributionThisCycle: number;
    percentOfTarget: number;
  })[] = [];

  for (const goal of goals) {
    if (goal.lifetimeTargetAmount > 0 && goal.savedSoFar >= goal.lifetimeTargetAmount) {
      completed.push(goal);
    } else if (goal.lifetimeTargetAmount > 0) {
      // In-progress goal: compute contribution this cycle.
      // Note: this requires caller to have passed SAVINGS transactions for this cycle
      // and matched them to the category. For now, we'll rely on caller providing
      // the contribution amount or compute it from passed transactions.
      inProgress.push({
        ...goal,
        contributionThisCycle: 0, // Caller must hydrate this.
        percentOfTarget: (goal.savedSoFar / goal.lifetimeTargetAmount) * 100,
      });
    }
  }

  return { completed, inProgress };
}

/**
 * Uncategorized warning: count and sum of EXPENSE transactions with no category.
 * Returns null if zero (drives whether the amber strip appears).
 */
export function computeUncategorizedWarning(financials: CycleFinancials): UncategorizedWarning | null {
  const uncategorized = financials.transactions.filter(
    (tx) => tx.type === "EXPENSE" && tx.expenseCategoryId === null
  );

  if (uncategorized.length === 0) {
    return null;
  }

  const totalAmount = uncategorized.reduce((sum, tx) => sum + tx.amount, 0);
  return { count: uncategorized.length, totalAmount };
}
