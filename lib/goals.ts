import { prisma } from "@/lib/prisma";

export interface GoalWithProgress {
  categoryId: string;
  name: string;
  icon: string | null;
  lifetimeTargetAmount: number;
  savedSoFar: number;
  currentCycleRecurringAmount: number | null;
}

interface DecimalLike {
  toNumber(): number;
}

interface GoalCategoryLike {
  id: string;
  name: string;
  icon: string | null;
  lifetimeTargetAmount: DecimalLike | null;
  transactions: { amount: DecimalLike }[];
  budgetGoals: { targetAmount: DecimalLike }[];
  manualAdjustment: DecimalLike;
}

/**
 * savedSoFar is the sum of every real SAVINGS transaction tied to this
 * category PLUS manualAdjustment -- a second, independent term for money
 * that was already saved before the goal existed in this app, or a
 * correction to the tracked total that was deliberately NOT logged as a
 * transaction (see adjustGoalContributionAction in goals/actions.ts). The
 * one place either term is combined -- summarizeGoalProgress below and
 * every reader of a goal's current total (adjustGoalContributionAction's
 * own before/after validation) shares this instead of each re-deriving it.
 */
export function computeSavedSoFar(
  transactions: { amount: DecimalLike }[],
  manualAdjustment: DecimalLike,
): number {
  const transactionsTotal = transactions.reduce((sum, tx) => sum + tx.amount.toNumber(), 0);
  return transactionsTotal + manualAdjustment.toNumber();
}

/**
 * Pure aggregation over an already-fetched category (with its SAVINGS
 * transactions and current-cycle budgetGoals included) — separated from the
 * fetch so the math (what actually caused the earlier quincena/monthly
 * overstatement bug class) is directly unit-testable without a database.
 */
export function summarizeGoalProgress(category: GoalCategoryLike): GoalWithProgress {
  const savedSoFar = computeSavedSoFar(category.transactions, category.manualAdjustment);
  const currentGoal = category.budgetGoals[0];

  return {
    categoryId: category.id,
    name: category.name,
    icon: category.icon,
    lifetimeTargetAmount: category.lifetimeTargetAmount?.toNumber() ?? 0,
    savedSoFar,
    currentCycleRecurringAmount: currentGoal ? currentGoal.targetAmount.toNumber() : null,
  };
}

export type ContributionDeltaResult = { ok: true; newSavedSoFar: number } | { ok: false; error: string };

/**
 * Pure validation for adjustGoalContributionAction — separated out so the
 * "can't go negative" rule is directly unit-testable without a database,
 * same reasoning as summarizeGoalProgress above. delta is signed: positive
 * for an increase, negative for a decrease.
 */
export function validateContributionDelta(currentSavedSoFar: number, delta: number): ContributionDeltaResult {
  const newSavedSoFar = Math.round((currentSavedSoFar + delta) * 100) / 100;
  if (newSavedSoFar < 0) {
    return { ok: false, error: "That would make the saved total negative" };
  }
  return { ok: true, newSavedSoFar };
}

/**
 * A "goal" is a SAVINGS-type ExpenseCategory with lifetimeTargetAmount set
 * (deliberately not a separate model — see prisma/schema.prisma). Progress
 * sums CycleTransaction across ALL cycles (personal-budgeting scale, no
 * pagination needed), not just the current one.
 */
export async function getGoalsWithProgress(
  userId: string,
  currentCycleId: string,
): Promise<GoalWithProgress[]> {
  const categories = await prisma.expenseCategory.findMany({
    where: { userId, type: "SAVINGS", lifetimeTargetAmount: { not: null } },
    include: {
      transactions: { where: { type: "SAVINGS" } },
      budgetGoals: { where: { cycleId: currentCycleId } },
    },
    orderBy: { createdAt: "asc" },
  });

  return categories.map(summarizeGoalProgress);
}
