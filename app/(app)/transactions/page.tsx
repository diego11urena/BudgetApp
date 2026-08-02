import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import type { CycleTransactionSummary } from "@/lib/cycle-financials";
import { getOrderedCategoryNames } from "@/lib/category-order";
import { TransactionForm } from "../_components/TransactionForm";
import { TransactionList } from "../_components/TransactionList";

export default async function TransactionsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const cycle = await getOrCreateDraftCycle(userId);

  const [rawTransactions, expenseCategoryNames, savingsCategoryNames] = await Promise.all([
    prisma.cycleTransaction.findMany({
      where: { cycle: { userId } },
      orderBy: { occurredAt: "desc" },
      take: 100,
      include: { expenseCategory: true, cycle: true },
    }),
    getOrderedCategoryNames(userId, cycle.id, "EXPENSE"),
    getOrderedCategoryNames(userId, cycle.id, "SAVINGS"),
  ]);

  const transactions: CycleTransactionSummary[] = rawTransactions.map((tx) => ({
    id: tx.id,
    type: tx.type,
    name: tx.name,
    amount: tx.amount.toNumber(),
    categoryName: tx.expenseCategory?.name ?? null,
    occurredAt: tx.occurredAt,
    cycleLabel: tx.cycle.label,
  }));

  return (
    <div className="home-page">
      <h1 className="page-title">Transactions</h1>

      <div className="dashboard-section">
        <h2>Log a transaction</h2>
        <TransactionForm
          expenseCategoryNames={expenseCategoryNames}
          savingsCategoryNames={savingsCategoryNames}
        />
      </div>

      <div className="dashboard-section">
        <h2>All transactions</h2>
        <TransactionList
          transactions={transactions}
          expenseCategoryNames={expenseCategoryNames}
          savingsCategoryNames={savingsCategoryNames}
          emptyMessage="No transactions logged yet."
        />
      </div>
    </div>
  );
}
