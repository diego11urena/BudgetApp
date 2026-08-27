import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import { formatCycleRangeText, getOrCreateDraftCycle } from "@/lib/cycles";
import type { CycleTransactionSummary } from "@/lib/cycle-financials";
import { toCycleTransactionSummary, TRANSACTION_SELECT } from "@/lib/cycle-financials";
import { getOrderedCategoryNames } from "@/lib/category-order";
import { formatCycleLabel } from "@/lib/pay-date";
import { TransactionList } from "../_components/TransactionList";
import { TransactionFilters } from "./_components/TransactionFilters";

const TX_TYPES = ["EXPENSE", "INCOME", "SAVINGS"] as const;
const PAYMENT_METHODS = ["CASH", "CREDIT_CARD", "DEBIT_CARD", "YAPPY", "ACH"] as const;

export const metadata: Metadata = { title: "Transactions" };

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    sort?: string;
    paymentMethod?: string;
    category?: string;
    /** Set by TransactionFilters' own quincena selector when viewing a past cycle -- absent means "the current cycle" (see cycle.id fallback below), not "every cycle ever." */
    cycleId?: string;
  }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const cycle = await getOrCreateDraftCycle(userId);
  const { q, type, sort, paymentMethod, category, cycleId } = await searchParams;

  const where: Prisma.CycleTransactionWhereInput = {
    // cycleId alone would be enough to scope correctly (a transaction's
    // cycle either belongs to this user or it doesn't), but keeping
    // cycle: { userId } unconditionally here too means a tampered/foreign
    // cycleId in the URL just matches zero rows rather than needing its
    // own separate ownership check.
    cycle: { userId },
    // Defaults to the current cycle, not "every cycle" -- with no filter
    // here, this page used to silently return the user's entire
    // transaction history (cut off at take: 100 below with no on-screen
    // indicator), the most abrupt scope jump in the app relative to every
    // other screen, which is cycle-scoped by default.
    cycleId: cycleId ?? cycle.id,
    ...(TX_TYPES.includes(type as (typeof TX_TYPES)[number]) ? { type: type as (typeof TX_TYPES)[number] } : {}),
    ...(PAYMENT_METHODS.includes(paymentMethod as (typeof PAYMENT_METHODS)[number])
      ? { paymentMethod: paymentMethod as (typeof PAYMENT_METHODS)[number] }
      : {}),
    ...(category === "uncategorized"
      ? { expenseCategoryId: null }
      : category
        ? { expenseCategoryId: category }
        : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { expenseCategory: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const isAmountSort = sort === "amount_desc" || sort === "amount_asc";
  const orderBy: Prisma.CycleTransactionOrderByWithRelationInput =
    sort === "date_asc"
      ? { occurredAt: "asc" }
      : sort === "amount_desc"
        ? { amount: "desc" }
        : sort === "amount_asc"
          ? { amount: "asc" }
          : { occurredAt: "desc" };

  const [rawTransactions, expenseCategoryNames, savingsCategoryNames, incomeCategoryNames, allCategories, recentCycles] =
    await Promise.all([
      prisma.cycleTransaction.findMany({
        where,
        orderBy,
        take: 100,
        // TRANSACTION_SELECT covers everything toCycleTransactionSummary
        // reads off the row itself; this page also names the cycle it
        // belongs to (a transaction can span cycles via the selector), so
        // only label/status are added on top -- not every BudgetCycle column.
        select: { ...TRANSACTION_SELECT, cycle: { select: { label: true, status: true } } },
      }),
      getOrderedCategoryNames(userId, cycle.id, "EXPENSE"),
      getOrderedCategoryNames(userId, cycle.id, "SAVINGS"),
      getOrderedCategoryNames(userId, cycle.id, "INCOME"),
      // Filtered by id, not name -- a name alone can collide across types
      // (e.g. an "Other" Expense category and a distinct "Other" Income
      // one), so the filter dropdown's options need to stay unambiguous.
      prisma.expenseCategory.findMany({
        where: { userId },
        select: { id: true, name: true },
        orderBy: [{ type: "asc" }, { name: "asc" }],
      }),
      // For TransactionFilters' quincena selector -- current cycle plus a
      // handful of recent closed ones. Only what a <select> needs, not the
      // heavier getRecentCycles (which also eager-loads every transaction/
      // income entry for financials math this page has no use for).
      prisma.budgetCycle.findMany({
        where: { userId },
        orderBy: { periodStart: "desc" },
        take: 6,
        select: { id: true, periodStart: true, periodEnd: true },
      }),
    ]);

  const transactions: CycleTransactionSummary[] = rawTransactions.map((tx) =>
    toCycleTransactionSummary(tx, {
      cycleLabel: tx.cycle.label,
      isEditable: tx.cycle.status !== "CLOSED",
    }),
  );

  // Current cycle first (TransactionFilters relies on this order -- see its
  // own prop comment), even though periodStart-desc would normally already
  // put it there; explicit rather than assumed, since "most recent
  // periodStart" and "the draft/active cycle" are two different concepts
  // that only happen to agree here.
  const cycleOptions = [
    cycle,
    ...recentCycles.filter((c) => c.id !== cycle.id),
  ].map((c) => ({ id: c.id, label: formatCycleRangeText(c, { includeYear: false }) }));

  return (
    <div className="home-page">
      <h1 className="page-title">Transactions</h1>

      <div className="dashboard-section">
        <TransactionFilters categories={allCategories} cycles={cycleOptions} />
        <TransactionList
          transactions={transactions}
          expenseCategoryNames={expenseCategoryNames}
          savingsCategoryNames={savingsCategoryNames}
          incomeCategoryNames={incomeCategoryNames}
          cycleStartDate={formatCycleLabel(cycle.periodStart)}
          emptyMessage={
            q || type || paymentMethod || category || cycleId
              ? "No transactions match your search."
              : "No transactions logged yet."
          }
          groupByDate={!isAmountSort}
        />
      </div>
    </div>
  );
}
