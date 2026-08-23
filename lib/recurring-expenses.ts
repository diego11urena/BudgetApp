import { prisma } from "@/lib/prisma";
import { findMatchSuggestion, type MatchCandidateTransaction } from "@/lib/recurring-expense-matching";

export interface RecurringExpenseWithStatus {
  id: string;
  name: string;
  targetAmount: number;
  /** Sum of this cycle's CycleTransaction rows actually linked to this recurring expense (via recordRecurringExpensePaymentAction or a confirmed match) -- never includes an unmatched transaction just because it's in the same category. */
  actual: number;
  recurring: boolean;
  frequency: "BIWEEKLY" | "MONTHLY";
  dueDay: number | null;
  suggestedMatch: { transactionId: string; name: string; amount: number } | null;
}

export interface CategoryWithRecurringExpenses {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  /** The maintained CycleBudgetGoal aggregate -- always equal to the sum of expenses[].targetAmount, computed here directly rather than re-queried. */
  targetAmount: number;
  /**
   * Sum of expenses[].actual -- only spend actually linked to one of this
   * category's recurring expenses, NOT every transaction posted to the
   * category (that's a different number -- see financials.categoryTotals /
   * sumRecurringExpenseCategorySpend, which the dashboard's legacy "fixed budget" card
   * still uses). Scoping it this way means adding or removing a recurring-
   * expense template can only ever move the target side of this bar, never
   * the actual side, and an unlinked transaction in the category can't
   * inflate or deflate a total that's supposed to represent only tracked
   * recurring expenses.
   */
  actual: number;
  expenses: RecurringExpenseWithStatus[];
}

/**
 * The Recurring Expenses screen's whole data model for one cycle: every
 * EXPENSE category that has at least one recurring expense with a
 * CycleRecurringExpense snapshot in this cycle, each with its own
 * per-expense payment status and, when nothing's paid yet, a best-effort
 * match suggestion drawn from this cycle's still-unlinked transactions in
 * the same category (see lib/recurring-expense-matching.ts). Works for any
 * cycle, open or closed -- History reuses this for a read-only past-cycle
 * breakdown, with computeSuggestions off since nothing there is actionable.
 */
export async function getRecurringExpensesForCycle(
  userId: string,
  cycleId: string,
  options: { computeSuggestions?: boolean } = {},
): Promise<CategoryWithRecurringExpenses[]> {
  const { computeSuggestions = true } = options;
  const snapshots = await prisma.cycleRecurringExpense.findMany({
    where: { cycleId, recurringExpense: { userId } },
    include: { recurringExpense: { include: { category: true } } },
    orderBy: { recurringExpense: { createdAt: "asc" } },
  });
  if (snapshots.length === 0) return [];

  const recurringExpenseIds = snapshots.map((s) => s.recurringExpenseId);
  const categoryIds = [...new Set(snapshots.map((s) => s.recurringExpense.categoryId))];

  const [paymentSums, unlinkedTransactions] = await Promise.all([
    prisma.cycleTransaction.groupBy({
      by: ["recurringExpenseId"],
      where: { cycleId, recurringExpenseId: { in: recurringExpenseIds } },
      _sum: { amount: true },
    }),
    computeSuggestions
      ? prisma.cycleTransaction.findMany({
          where: { cycleId, expenseCategoryId: { in: categoryIds }, recurringExpenseId: null },
          select: { id: true, name: true, amount: true, expenseCategoryId: true },
        })
      : Promise.resolve([]),
  ]);

  const paidByExpenseId = new Map(
    paymentSums
      .filter((row): row is typeof row & { recurringExpenseId: string } => row.recurringExpenseId !== null)
      .map((row) => [row.recurringExpenseId, row._sum.amount?.toNumber() ?? 0]),
  );

  const candidatesByCategory = new Map<string, MatchCandidateTransaction[]>();
  for (const transaction of unlinkedTransactions) {
    if (!transaction.expenseCategoryId) continue;
    const list = candidatesByCategory.get(transaction.expenseCategoryId) ?? [];
    list.push({
      id: transaction.id,
      name: transaction.name,
      amount: transaction.amount.toNumber(),
      categoryId: transaction.expenseCategoryId,
      recurringExpenseId: null,
    });
    candidatesByCategory.set(transaction.expenseCategoryId, list);
  }

  const categoriesMap = new Map<string, CategoryWithRecurringExpenses>();
  for (const snapshot of snapshots) {
    const recurringExpense = snapshot.recurringExpense;
    const category = recurringExpense.category;
    const targetAmount = snapshot.targetAmount.toNumber();
    const actual = paidByExpenseId.get(recurringExpense.id) ?? 0;

    let suggestedMatch: RecurringExpenseWithStatus["suggestedMatch"] = null;
    if (actual === 0) {
      const candidates = candidatesByCategory.get(category.id) ?? [];
      const match = findMatchSuggestion(
        { id: recurringExpense.id, name: recurringExpense.name, amount: targetAmount, categoryId: category.id },
        candidates,
      );
      if (match) {
        suggestedMatch = { transactionId: match.id, name: match.name, amount: match.amount };
      }
    }

    if (!categoriesMap.has(category.id)) {
      categoriesMap.set(category.id, {
        categoryId: category.id,
        categoryName: category.name,
        categoryIcon: category.icon,
        targetAmount: 0,
        actual: 0,
        expenses: [],
      });
    }

    const entry = categoriesMap.get(category.id)!;
    entry.targetAmount += targetAmount;
    entry.actual += actual;
    entry.expenses.push({
      id: recurringExpense.id,
      name: recurringExpense.name,
      targetAmount,
      actual,
      recurring: recurringExpense.recurring,
      frequency: recurringExpense.frequency,
      dueDay: recurringExpense.dueDay,
      suggestedMatch,
    });
  }

  return [...categoriesMap.values()];
}
