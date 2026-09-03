import { nextCycleStart, type BudgetFrequency } from "./quincena-pace";
import { nowInPanama } from "./pay-date";

export interface GoalProjection {
  /** Amount left to save, clamped to 0. */
  remaining: number;
  /** Saved-so-far / target, clamped to [0, 100] for a ring/bar; the raw value can exceed 100. */
  percentage: number;
  isComplete: boolean;
  /** Cycles needed at the current per-cycle contribution — null if there's no contribution to project from. */
  cyclesNeeded: number | null;
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
  // Defaults to QUINCENAL (today's only cadence) so every not-yet-updated
  // caller keeps its current behavior -- callers without the user's real
  // setting in scope yet (e.g. onboarding's own cadence-picker step, Plan's
  // GoalRow before Phase 4 wires budgetFrequency through LocaleProvider) fall
  // back to this rather than needing an extra prop-drilled value they can't
  // supply correctly yet.
  frequency?: BudgetFrequency;
}): GoalProjection {
  const { savedSoFar, lifetimeTargetAmount, currentCycleRecurringAmount, frequency = "QUINCENAL" } = input;
  const now = input.now ?? nowInPanama();

  const remaining = Math.max(lifetimeTargetAmount - savedSoFar, 0);
  const percentage =
    lifetimeTargetAmount > 0 ? Math.min((savedSoFar / lifetimeTargetAmount) * 100, 100) : 0;
  const isComplete = remaining <= 0;

  if (isComplete || !currentCycleRecurringAmount || currentCycleRecurringAmount <= 0) {
    return { remaining, percentage, isComplete, cyclesNeeded: null, etaDate: null };
  }

  const cyclesNeeded = Math.ceil(remaining / currentCycleRecurringAmount);
  // Walks forward through cyclesNeeded *real* cycles (13-16 days each for
  // QUINCENAL, ~28-31 for MONTHLY, depending on where each one falls in the
  // calendar) instead of a flat step per cycle — the same fix as
  // lib/quincena-pace.ts, reusing its boundary logic so the two can't
  // quietly disagree.
  let etaDate = new Date(now);
  for (let i = 0; i < cyclesNeeded; i++) {
    etaDate = nextCycleStart(etaDate, frequency);
  }

  return { remaining, percentage, isComplete, cyclesNeeded, etaDate };
}
