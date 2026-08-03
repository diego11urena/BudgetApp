const QUINCENA_DAYS = 15;

export interface GoalProjection {
  /** Amount left to save, clamped to 0. */
  remaining: number;
  /** Saved-so-far / target, clamped to [0, 100] for a ring/bar; the raw value can exceed 100. */
  percentage: number;
  isComplete: boolean;
  /** Quincenas needed at the current per-cycle contribution — null if there's no contribution to project from. */
  quincenasNeeded: number | null;
  /** Projected completion date at the current per-cycle contribution — null if it can't be projected. */
  etaDate: Date | null;
}

/**
 * Projects when a goal will be reached from its per-cycle contribution
 * (the planned CycleBudgetGoal target, not the actual amount logged this
 * cycle) and what's left to save — matches how the UI states it: "Per-cycle
 * contribution: $X -> on track to hit goal by [date]".
 */
export function computeGoalProjection(input: {
  savedSoFar: number;
  lifetimeTargetAmount: number;
  currentCycleRecurringAmount: number | null;
  now?: Date;
}): GoalProjection {
  const { savedSoFar, lifetimeTargetAmount, currentCycleRecurringAmount } = input;
  const now = input.now ?? new Date();

  const remaining = Math.max(lifetimeTargetAmount - savedSoFar, 0);
  const percentage =
    lifetimeTargetAmount > 0 ? Math.min((savedSoFar / lifetimeTargetAmount) * 100, 100) : 0;
  const isComplete = remaining <= 0;

  if (isComplete || !currentCycleRecurringAmount || currentCycleRecurringAmount <= 0) {
    return { remaining, percentage, isComplete, quincenasNeeded: null, etaDate: null };
  }

  const quincenasNeeded = Math.ceil(remaining / currentCycleRecurringAmount);
  const etaDate = new Date(now);
  etaDate.setDate(etaDate.getDate() + quincenasNeeded * QUINCENA_DAYS);

  return { remaining, percentage, isComplete, quincenasNeeded, etaDate };
}
