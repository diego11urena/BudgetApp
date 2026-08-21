import { prisma } from "@/lib/prisma";

export interface CategoryUsage {
  categoryId: string;
  /** All-time, not scoped to the current cycle -- this is context for "why does this category exist," not a per-cycle stat. */
  transactionCount: number;
  totalAmount: number;
  /** Has any CycleBudgetGoal row, ever -- a brand-new recurring fixed expense with 0 transactions logged yet is still "used," not "unused." */
  hasBudgetGoal: boolean;
  isUnused: boolean;
}

interface RawCategoryUsage {
  categoryId: string;
  transactionCount: number;
  totalAmount: number;
  hasBudgetGoal: boolean;
}

/** Pure -- separated from the fetch so "what counts as unused" is unit-testable without a database, same reasoning as summarizeGoalProgress in lib/goals.ts. */
export function summarizeCategoryUsage(raw: RawCategoryUsage): CategoryUsage {
  return { ...raw, isUnused: raw.transactionCount === 0 && !raw.hasBudgetGoal };
}

/**
 * Per-category usage stats for a user's categories of one type -- powers
 * the Manage Categories screen's "N transactions · $X.XX" secondary line
 * and its active/unused split. Derived live from CycleTransaction/
 * CycleBudgetGoal (same store those already live in), not a denormalized
 * counter, matching lib/category-order.ts's getOrderedCategoryNames.
 */
export async function getCategoryUsageStats(
  userId: string,
  type: "EXPENSE" | "INCOME" | "SAVINGS",
): Promise<Map<string, CategoryUsage>> {
  const categories = await prisma.expenseCategory.findMany({
    where: { userId, type },
    select: { id: true },
  });
  if (categories.length === 0) return new Map();

  const categoryIds = categories.map((c) => c.id);

  const [transactionGroups, budgetGoalRows] = await Promise.all([
    prisma.cycleTransaction.groupBy({
      by: ["expenseCategoryId"],
      where: { expenseCategoryId: { in: categoryIds } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.cycleBudgetGoal.findMany({
      where: { expenseCategoryId: { in: categoryIds } },
      select: { expenseCategoryId: true },
      distinct: ["expenseCategoryId"],
    }),
  ]);

  const transactionsByCategory = new Map(
    transactionGroups.map((row) => [row.expenseCategoryId, row]),
  );
  const categoriesWithBudgetGoal = new Set(budgetGoalRows.map((row) => row.expenseCategoryId));

  const result = new Map<string, CategoryUsage>();
  for (const id of categoryIds) {
    const tx = transactionsByCategory.get(id);
    result.set(
      id,
      summarizeCategoryUsage({
        categoryId: id,
        transactionCount: tx?._count._all ?? 0,
        totalAmount: tx?._sum.amount?.toNumber() ?? 0,
        hasBudgetGoal: categoriesWithBudgetGoal.has(id),
      }),
    );
  }
  return result;
}
