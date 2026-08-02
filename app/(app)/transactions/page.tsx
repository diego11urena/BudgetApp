import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { CycleTransactionSummary } from "@/lib/cycle-financials";
import { TransactionForm } from "../_components/TransactionForm";
import { TransactionList } from "../_components/TransactionList";

export default async function TransactionsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const [rawTransactions, expenseCategories, savingsCategories] = await Promise.all([
    prisma.cycleTransaction.findMany({
      where: { cycle: { userId } },
      orderBy: { occurredAt: "desc" },
      take: 100,
      include: { expenseCategory: true, cycle: true },
    }),
    prisma.expenseCategory.findMany({ where: { userId, type: "EXPENSE" }, select: { name: true } }),
    prisma.expenseCategory.findMany({ where: { userId, type: "SAVINGS" }, select: { name: true } }),
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
          expenseCategoryNames={expenseCategories.map((c) => c.name)}
          savingsCategoryNames={savingsCategories.map((c) => c.name)}
        />
      </div>

      <div className="dashboard-section">
        <h2>All transactions</h2>
        <TransactionList
          transactions={transactions}
          emptyMessage="No transactions logged yet."
        />
      </div>
    </div>
  );
}
