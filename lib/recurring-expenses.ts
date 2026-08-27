import { prisma } from "@/lib/prisma";
import { findMatchSuggestion, type MatchCandidateTransaction } from "@/lib/recurring-expense-matching";
import { getRecurringExpensePaymentStatus } from "@/lib/recurring-expense-status";

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
   * category (that's a different number -- see financials.categoryTotals).
   * Scoping it this way means adding or removing a recurring-expense
   * template can only ever move the target side of this bar, never the
   * actual side, and an unlinked transaction in the category can't
   * inflate or deflate a total that's supposed to represent only tracked
   * recurring expenses. This is the app's one definition of "fixed budget
   * used" -- the dashboard's own summary card and /budget's own category
   * rows both derive from this same actual/targetAmount pair (via
   * summarizeRecurringExpenses below), so they can no longer disagree.
   */
  actual: number;
  expenses: RecurringExpenseWithStatus[];
}

export interface RecurringExpensesSummary {
  /** Sum of every recurring expense's own target this cycle, across every category. */
  totalTarget: number;
  /** Sum of every recurring expense's own linked actual this cycle, across every category -- same actual/targetAmount pair /budget's own rows use, never financials.categoryTotals' unscoped category spend. */
  totalActual: number;
  /** How many recurring expenses exist this cycle, across every category. */
  totalCount: number;
  /** How many have been paid to at least their own target (status paid, paid-over, or exceeded). */
  paidCount: number;
  /** Sum of (targetAmount - actual), floored at 0 per expense, for everything not yet fully paid -- what's left to pay this cycle. */
  pendingAmount: number;
}

/**
 * The one place "how much of this cycle's recurring-expense budget is
 * used" gets computed from -- consumed both by the dashboard's own summary
 * card (as a paid-count, "4 of 7 paid") and by justGotPaidAction's closed-
 * cycle "over budget by" figure (via getBudgetUsage(totalActual,
 * totalTarget)), so the two can never again quote two different numbers
 * for the same question the way BudgetBreakdownCard's old spent/budget
 * props (sourced from the unrelated sumRecurringExpenseCategorySpend) once
 * did.
 */
export function summarizeRecurringExpenses(categories: CategoryWithRecurringExpenses[]): RecurringExpensesSummary {
  let totalTarget = 0;
  let totalActual = 0;
  let totalCount = 0;
  let paidCount = 0;
  let pendingAmount = 0;

  for (const category of categories) {
    for (const expense of category.expenses) {
      totalTarget += expense.targetAmount;
      totalActual += expense.actual;
      totalCount++;
      const status = getRecurringExpensePaymentStatus(expense.actual, expense.targetAmount);
      if (status === "paid" || status === "paid-over" || status === "exceeded") {
        paidCount++;
      } else {
        pendingAmount += Math.max(expense.targetAmount - expense.actual, 0);
      }
    }
  }

  return { totalTarget, totalActual, totalCount, paidCount, pendingAmount };
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

  // dueDay is meaningful sort order for the one frequency that has it --
  // whichever MONTHLY bill comes due soonest belongs at the top, ahead of
  // whatever happened to be created first. BIWEEKLY expenses (dueDay always
  // null) have no calendar day to sort by, so they keep insertion order and
  // sink below any MONTHLY ones via Infinity.
  for (const category of categoriesMap.values()) {
    category.expenses.sort((a, b) => (a.dueDay ?? Infinity) - (b.dueDay ?? Infinity));
  }

  return [...categoriesMap.values()];
}
