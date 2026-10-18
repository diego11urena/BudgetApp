import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { findMatchSuggestion, type MatchCandidateTransaction } from "@/lib/recurring-expense-matching";
import { getRecurringExpensePaymentStatus, type RecurringExpensePaymentStatus } from "@/lib/recurring-expense-status";
import { dueDayFallsWithinCycle } from "@/lib/quincena-pace";

export interface RecurringExpenseWithStatus {
  id: string;
  name: string;
  targetAmount: number;
  /** Sum of this cycle's CycleTransaction rows actually linked to this recurring expense (via recordRecurringExpensePaymentAction or a confirmed match) -- never includes an unmatched transaction just because it's in the same category. */
  actual: number;
  recurring: boolean;
  /** Day of the month it's charged, or null for no set date. */
  dueDay: number | null;
  /**
   * Whether it's charged during this cycle: no set date, a dueDay that
   * falls inside the cycle, or a payment already linked this cycle (paid
   * early or late still counts where it was paid). False puts it under
   * the Plan tab's "Not charged this cycle" and out of every total here,
   * so safe to spend never reserves money for it.
   */
  chargedThisCycle: boolean;
  status: RecurringExpensePaymentStatus;
  suggestedMatch: { transactionId: string; name: string; amount: number } | null;
}

export interface CategoryWithRecurringExpenses {
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  /**
   * This category's EXPENSE budget for the cycle -- the sum of
   * expenses[].targetAmount, computed here directly rather than re-queried.
   * Named distinctly from CycleBudgetGoal.targetAmount, the same DB column
   * a SAVINGS category's own goal contribution is stored in (see
   * GoalWithProgress.currentCycleRecurringAmount in lib/goals.ts) -- the
   * two are unrelated numbers that happen to share a column, and giving
   * them different names in code is the whole fix (see the fix-list's
   * vocabulary section).
   */
  budgetTotal: number;
  /**
   * Sum of expenses[].actual for items charged this cycle -- only spend
   * actually linked to one of this category's recurring expenses, NOT
   * every transaction posted to the category (that's a different number --
   * see financials.categoryTotals). Scoping it this way means adding or
   * removing a recurring-expense template can only ever move the target
   * side of this bar, never the actual side, and an unlinked transaction
   * in the category can't inflate or deflate a total that's supposed to
   * represent only tracked recurring expenses. This is the app's one
   * definition of "fixed budget used" -- the dashboard's own summary card
   * and /budget's own category rows both derive from this same
   * actual/targetAmount pair (via summarizeRecurringExpenses below), so
   * they can no longer disagree.
   */
  actual: number;
  expenses: RecurringExpenseWithStatus[];
}

export interface RecurringExpensesSummary {
  /** Sum of every charged-this-cycle recurring expense's own target, across every category. */
  totalTarget: number;
  /** Sum of every charged-this-cycle recurring expense's own linked actual -- never financials.categoryTotals' unscoped category spend. */
  totalActual: number;
  /** How many recurring expenses are charged this cycle. */
  totalCount: number;
  /** How many of those have been paid to at least their own target (status paid, paid-over, or exceeded). */
  paidCount: number;
  /** Sum of (targetAmount - actual), floored at 0, across charged-this-cycle expenses not yet fully paid -- what's left to pay this cycle. */
  pendingAmount: number;
}

/**
 * The one place "how much of this cycle's recurring-expense budget is
 * used" gets computed from -- consumed both by the dashboard's own summary
 * card (as a paid-count, "4 of 7 paid"), HeroCard's "safe to spend" figure
 * (which subtracts pendingAmount), and justGotPaidAction's closed-cycle
 * "over budget by" figure (via getBudgetUsage(totalActual, totalTarget)),
 * so none of them can quote a different number for the same question.
 *
 * Only items charged this cycle count (see chargedThisCycle): one dated
 * outside the cycle still appears in category.expenses for display, under
 * "Not charged this cycle", but never contributes to any total here.
 */
export function summarizeRecurringExpenses(categories: CategoryWithRecurringExpenses[]): RecurringExpensesSummary {
  let totalTarget = 0;
  let totalActual = 0;
  let totalCount = 0;
  let paidCount = 0;
  let pendingAmount = 0;

  for (const category of categories) {
    for (const expense of category.expenses) {
      if (!expense.chargedThisCycle) continue;
      totalTarget += expense.targetAmount;
      totalActual += expense.actual;
      totalCount++;
      if (expense.status === "paid" || expense.status === "paid-over" || expense.status === "exceeded") {
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
  const [snapshots, cycle, user] = await Promise.all([
    prisma.cycleRecurringExpense.findMany({
      where: { cycleId, recurringExpense: { userId } },
      include: { recurringExpense: { include: { category: true } } },
      orderBy: { recurringExpense: { createdAt: "asc" } },
    }),
    prisma.budgetCycle.findUniqueOrThrow({ where: { id: cycleId }, select: { periodStart: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { budgetFrequency: true } }),
  ]);
  if (snapshots.length === 0) return [];

  const recurringExpenseIds = snapshots.map((s) => s.recurringExpenseId);
  const categoryIds = [...new Set(snapshots.map((s) => s.recurringExpense.categoryId))];

  const [paymentSums, unlinkedTransactions] = await Promise.all([
    prisma.cycleTransaction.groupBy({
      by: ["recurringExpenseId"],
      where: { cycleId, recurringExpenseId: { in: recurringExpenseIds } },
      _sum: { amount: true },
    }),
    // expenseCategoryId: null included alongside the recurring expenses' own categories --
    // a brand-new Gmail-imported merchant this user has never categorized
    // before lands with no category at all (see gmail-sync.ts's
    // findLearnedCategoryId), and used to be structurally excluded from
    // matching here regardless of how well its name matched one.
    // findMatchSuggestion itself still refuses a candidate already sitting
    // in a genuinely DIFFERENT category -- this only widens the pool to
    // include the ones with no category yet.
    computeSuggestions
      ? prisma.cycleTransaction.findMany({
          where: {
            cycleId,
            recurringExpenseId: null,
            OR: [{ expenseCategoryId: { in: categoryIds } }, { expenseCategoryId: null }],
          },
          select: { id: true, name: true, amount: true, expenseCategoryId: true },
        })
      : Promise.resolve([]),
  ]);

  const paidByExpenseId = new Map(
    paymentSums
      .filter((row): row is typeof row & { recurringExpenseId: string } => row.recurringExpenseId !== null)
      .map((row) => [row.recurringExpenseId, row._sum.amount?.toNumber() ?? 0]),
  );

  // Every recurring expense's own candidate pool is its same-category transactions PLUS
  // the shared uncategorized pool below -- findMatchSuggestion applies its
  // own name/amount filtering per recurring expense, so handing every one the same
  // uncategorized transactions is safe (an uncategorized transaction that
  // matches nothing's name just never gets suggested for anything).
  const candidatesByCategory = new Map<string, MatchCandidateTransaction[]>();
  const uncategorizedCandidates: MatchCandidateTransaction[] = [];
  for (const transaction of unlinkedTransactions) {
    const candidate: MatchCandidateTransaction = {
      id: transaction.id,
      name: transaction.name,
      amount: transaction.amount.toNumber(),
      categoryId: transaction.expenseCategoryId,
      recurringExpenseId: null,
    };
    if (transaction.expenseCategoryId) {
      const list = candidatesByCategory.get(transaction.expenseCategoryId) ?? [];
      list.push(candidate);
      candidatesByCategory.set(transaction.expenseCategoryId, list);
    } else {
      uncategorizedCandidates.push(candidate);
    }
  }

  const categoriesMap = new Map<string, CategoryWithRecurringExpenses>();
  for (const snapshot of snapshots) {
    const recurringExpense = snapshot.recurringExpense;
    const category = recurringExpense.category;
    const targetAmount = snapshot.targetAmount.toNumber();
    const actual = paidByExpenseId.get(recurringExpense.id) ?? 0;

    let suggestedMatch: RecurringExpenseWithStatus["suggestedMatch"] = null;
    if (actual === 0) {
      const candidates = [...(candidatesByCategory.get(category.id) ?? []), ...uncategorizedCandidates];
      const match = findMatchSuggestion(
        {
          id: recurringExpense.id,
          name: recurringExpense.name,
          amount: targetAmount,
          categoryId: category.id,
          dueDay: recurringExpense.dueDay,
        },
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
        budgetTotal: 0,
        actual: 0,
        expenses: [],
      });
    }

    const dueDay = recurringExpense.dueDay;
    const chargedThisCycle =
      dueDay === null || actual > 0 || dueDayFallsWithinCycle(dueDay, cycle.periodStart, user.budgetFrequency);

    const entry = categoriesMap.get(category.id)!;
    if (chargedThisCycle) {
      entry.budgetTotal += targetAmount;
      entry.actual += actual;
    }
    entry.expenses.push({
      id: recurringExpense.id,
      name: recurringExpense.name,
      targetAmount,
      actual,
      recurring: recurringExpense.recurring,
      dueDay,
      chargedThisCycle,
      status: getRecurringExpensePaymentStatus(actual, targetAmount),
      suggestedMatch,
    });
  }

  // Dated items first, soonest due day at the top; undated ones after,
  // alphabetically -- there's no calendar day to rank them by, and a name
  // order is what makes "did I already add Panapass?" scannable.
  for (const category of categoriesMap.values()) {
    category.expenses.sort(
      (a, b) => (a.dueDay ?? Infinity) - (b.dueDay ?? Infinity) || a.name.localeCompare(b.name),
    );
  }

  return [...categoriesMap.values()];
}

export interface RecurringExpenseOption {
  id: string;
  name: string;
  amount: number;
}

/**
 * Every EXPENSE-category recurring expense the user has ever defined
 * (dated or not, recurring or one-time, in any cycle) -- feeds the
 * transaction sheet's "Which recurring expense?" picker (see
 * RecurringExpensePicker.tsx), where a transaction can be linked to an
 * existing one by an explicit choice rather than only an exact name match
 * (see linkTransactionToRecurringExpense in lib/cycles.ts). Deliberately
 * not scoped to the current cycle: one defined in an earlier cycle, or one
 * this cycle simply hasn't carried forward yet, is still something the
 * user might want to link a transaction to -- linking re-establishes this
 * cycle's own CycleRecurringExpense snapshot if one doesn't already exist.
 *
 * Wrapped in cache() for the same reason getOrderedCategoryNames is --
 * every page that mounts a QuickAddSheet (layout.tsx for BottomNav's own
 * mount, plus dashboard/transactions/history's own) fetches this once per
 * request instead of once per mount.
 */
export const getRecurringExpenseOptions = cache(async (userId: string): Promise<RecurringExpenseOption[]> => {
  const expenses = await prisma.recurringExpense.findMany({
    where: { userId },
    select: { id: true, name: true, amount: true },
    orderBy: { name: "asc" },
  });
  return expenses.map((e) => ({ id: e.id, name: e.name, amount: e.amount.toNumber() }));
});
