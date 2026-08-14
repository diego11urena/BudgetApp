import { redirect } from "next/navigation";
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
  }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const cycle = await getOrCreateDraftCycle(userId);
  const { q, type, sort, paymentMethod, category } = await searchParams;

  const where: Prisma.CycleTransactionWhereInput = {
    cycle: { userId },
    ...(TX_TYPES.includes(type as (typeof TX_TYPES)[number]) ? { type: type as (typeof TX_TYPES)[number] } : {}),
    ...(PAYMENT_METHODS.includes(paymentMethod as (typeof PAYMENT_METHODS)[number])
      ? { paymentMethod: paymentMethod as (typeof PAYMENT_METHODS)[number] }
      : {}),
    ...(category === "uncategorized" ? { expenseCategoryId: null } : {}),
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

  const [rawTransactions, expenseCategoryNames, savingsCategoryNames, incomeCategoryNames] =
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
    ]);

  const transactions: CycleTransactionSummary[] = rawTransactions.map((tx) =>
    toCycleTransactionSummary(tx, {
      cycleLabel: tx.cycle.label,
      isEditable: tx.cycle.status !== "CLOSED",
    }),
  );

  return (
    <div className="home-page">
      <h1 className="page-title">Transactions</h1>

      <div className="dashboard-section">
        <TransactionFilters />
        <TransactionList
          transactions={transactions}
          expenseCategoryNames={expenseCategoryNames}
          savingsCategoryNames={savingsCategoryNames}
          incomeCategoryNames={incomeCategoryNames}
          cycleStartDate={formatCycleLabel(cycle.periodStart)}
          emptyMessage={
            q || type || paymentMethod || category
              ? "No transactions match your search."
              : "No transactions logged yet."
          }
          groupByDate={!isAmountSort}
        />
      </div>
    </div>
  );
}
