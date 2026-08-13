import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCycleFinancials } from "@/lib/cycle-financials";
import { getOrderedCategoryNames } from "@/lib/category-order";
import { formatCurrency } from "@/lib/format";
import { formatCycleLabel } from "@/lib/pay-date";
import { TransactionList } from "../../_components/TransactionList";

export default async function CycleHistoryPage({
  params,
}: {
  params: Promise<{ cycleId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const { cycleId } = await params;

  const cycle = await prisma.budgetCycle.findFirst({
    where: { id: cycleId, userId },
  });
  if (!cycle) {
    redirect("/dashboard");
  }

  const isEditable = cycle.status !== "CLOSED";

  const [financials, expenseCategoryNames, savingsCategoryNames] = await Promise.all([
    getCycleFinancials(cycle.id),
    getOrderedCategoryNames(userId, cycle.id, "EXPENSE"),
    getOrderedCategoryNames(userId, cycle.id, "SAVINGS"),
  ]);

  const transactions = financials.transactions.map((tx) => ({ ...tx, isEditable }));

  return (
    <div className="home-page">
      <Link href="/dashboard" className="back-link">
        ← Back
      </Link>
      <h1 className="page-title">
        {cycle.label} ({cycle.status})
      </h1>

      <div className="dashboard-section">
        <div className="summary-row">
          <div className="summary-item">
            <span className="summary-label">Spent</span>
            <span className="summary-value">{formatCurrency(financials.totalExpenses)}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Saved</span>
            <span className="summary-value summary-value--good">
              {formatCurrency(financials.totalSavings)}
            </span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Left</span>
            <span
              className={`summary-value ${financials.amountLeft >= 0 ? "summary-value--good" : ""}`}
            >
              {formatCurrency(financials.amountLeft)}
            </span>
          </div>
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Transactions</h2>
        <TransactionList
          transactions={transactions}
          expenseCategoryNames={expenseCategoryNames}
          savingsCategoryNames={savingsCategoryNames}
          cycleStartDate={formatCycleLabel(cycle.periodStart)}
          emptyMessage="Nothing logged in this quincena."
        />
      </div>
    </div>
  );
}
