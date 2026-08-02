import { prisma } from "@/lib/prisma";

export interface BudgetGoalWithCategory {
  id: string;
  categoryId: string;
  categoryName: string;
  targetAmount: number;
}

/** A cycle's budget goals for one category type, with plain-number amounts for display. */
export async function getCycleBudgetGoals(
  cycleId: string,
  categoryType: "EXPENSE" | "SAVINGS",
): Promise<BudgetGoalWithCategory[]> {
  const goals = await prisma.cycleBudgetGoal.findMany({
    where: { cycleId, expenseCategory: { type: categoryType } },
    include: { expenseCategory: true },
    orderBy: { createdAt: "asc" },
  });

  return goals.map((goal) => ({
    id: goal.id,
    categoryId: goal.expenseCategoryId,
    categoryName: goal.expenseCategory.name,
    targetAmount: goal.targetAmount.toNumber(),
  }));
}
