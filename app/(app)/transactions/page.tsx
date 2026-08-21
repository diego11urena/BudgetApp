import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import type { CycleTransactionSummary } from "@/lib/cycle-financials";
import { toCycleTransactionSummary } from "@/lib/cycle-financials";
import { getOrderedCategoryNames } from "@/lib/category-order";
import { formatCycleLabel } from "@/lib/pay-date";
import { TransactionList } from "../_components/TransactionList";
import { TransactionFilters } from "./_components/TransactionFilters";

const TX_TYPES = ["EXPENSE", "INCOME", "SAVINGS"] as const;
const PAYMENT_METHODS = ["CASH", "CREDIT_CARD", "DEBIT_CARD", "YAPPY", "ACH"] as const;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    type?: string;
    sort?: string;
    paymentMethod?: string;
    category?: string;
    /** Set only when arriving from a Fixed Expenses row tap -- scopes the list to that one cycle and shows a way back. Not exposed in TransactionFilters' own UI (nothing there sets or clears it). */
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
    ...(cycleId ? { cycleId } : {}),
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

  const [rawTransactions, expenseCategoryNames, savingsCategoryNames, incomeCategoryNames, allCategories] =
    await Promise.all([
      prisma.cycleTransaction.findMany({
        where,
        orderBy,
        take: 100,
        include: { expenseCategory: true, cycle: true },
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
    ]);

  const transactions: CycleTransactionSummary[] = rawTransactions.map((tx) =>
    toCycleTransactionSummary(tx, {
      cycleLabel: tx.cycle.label,
      isEditable: tx.cycle.status !== "CLOSED",
    }),
  );

  return (
    <div className="home-page">
      {cycleId && (
        <Link href="/budget" className="back-link">
          <ChevronLeft size={16} aria-hidden="true" /> Back to Fixed Expenses
        </Link>
      )}
      <h1 className="page-title">Transactions</h1>

      <div className="dashboard-section">
        <TransactionFilters categories={allCategories} />
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
