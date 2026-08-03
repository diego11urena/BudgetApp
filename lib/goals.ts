import { prisma } from "@/lib/prisma";

export interface GoalWithProgress {
  categoryId: string;
  name: string;
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
  lifetimeTargetAmount: DecimalLike | null;
  transactions: { amount: DecimalLike }[];
  budgetGoals: { targetAmount: DecimalLike }[];
}

/**
 * Pure aggregation over an already-fetched category (with its SAVINGS
 * transactions and current-cycle budgetGoals included) — separated from the
 * fetch so the math (what actually caused the earlier quincena/monthly
 * overstatement bug class) is directly unit-testable without a database.
 */
export function summarizeGoalProgress(category: GoalCategoryLike): GoalWithProgress {
  const savedSoFar = category.transactions.reduce((sum, tx) => sum + tx.amount.toNumber(), 0);
  const currentGoal = category.budgetGoals[0];

  return {
    categoryId: category.id,
    name: category.name,
    lifetimeTargetAmount: category.lifetimeTargetAmount?.toNumber() ?? 0,
    savedSoFar,
    currentCycleRecurringAmount: currentGoal ? currentGoal.targetAmount.toNumber() : null,
  };
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
