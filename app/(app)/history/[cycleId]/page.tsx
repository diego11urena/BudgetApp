import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAdjacentCycles, formatCycleRangeText } from "@/lib/cycles";
import { getCycleFinancials, sumFixedTargetSpend } from "@/lib/cycle-financials";
import { getCycleBudgetGoals } from "@/lib/budget-goals";
import { getOrderedCategoryNames } from "@/lib/category-order";
import { formatCycleLabel } from "@/lib/pay-date";
import { TransactionList } from "../../_components/TransactionList";
import { HeroCard } from "../../dashboard/_components/HeroCard";
import { BudgetBreakdownCard } from "../../dashboard/_components/BudgetBreakdownCard";
import { TopCategoriesChart } from "../../dashboard/_components/TopCategoriesChart";
import { EditPayInfoButton } from "../../dashboard/_components/EditPayInfoButton";
import { AddToCycleButton } from "../_components/AddToCycleButton";

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

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
    redirect("/history");
  }

  const closed = cycle.status === "CLOSED";

  const [financials, expenseGoals, expenseCategoryNames, savingsCategoryNames, incomeCategoryNames, { previous, next }] =
    await Promise.all([
      getCycleFinancials(cycle.id),
      getCycleBudgetGoals(cycle.id, "EXPENSE"),
      getOrderedCategoryNames(userId, cycle.id, "EXPENSE"),
      getOrderedCategoryNames(userId, cycle.id, "SAVINGS"),
      getOrderedCategoryNames(userId, cycle.id, "INCOME"),
      getAdjacentCycles(userId, cycle),
    ]);

  const totalBudget = expenseGoals.reduce((sum, goal) => sum + goal.targetAmount, 0);
  const fixedSpent = sumFixedTargetSpend(
    financials.categoryTotals,
    expenseGoals.map((goal) => goal.categoryId),
  );

  const cycleStartDate = formatCycleLabel(cycle.periodStart);
  // Exclusive neighbor boundaries -> inclusive HTML date-input min/max for
  // EditPayInfoSheet's pay-date field.
  const previousBoundDate = previous ? formatCycleLabel(addDays(previous.periodStart, 1)) : null;
  const nextBoundDate = next ? formatCycleLabel(addDays(next.periodStart, -1)) : null;

  return (
    <div className="home-page">
      <Link href="/history" className="back-link">
        <ChevronLeft size={16} aria-hidden="true" /> Back
      </Link>

      <div className="home-header">
        <div>
          <p className="home-greeting">{formatCycleRangeText(cycle)}</p>
          <div className="home-month">
            {closed ? "Closed" : "Active"}
            {closed && (
              <EditPayInfoButton
                currentAmount={financials.baseIncome}
                currentPayDate={cycleStartDate}
                cycleId={cycle.id}
                closed
                previousBoundDate={previousBoundDate}
                nextBoundDate={nextBoundDate}
              />
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-section dashboard-section--plain">
        <HeroCard
          amountLeft={financials.amountLeft}
          periodStart={cycle.periodStart}
          totalExpenses={financials.totalExpenses}
          closed={closed}
        />
      </div>

      <div className="dashboard-section">
        <BudgetBreakdownCard
          baseIncome={financials.baseIncome}
          extraIncome={financials.extraIncome}
          saved={financials.totalSavings}
          spent={fixedSpent}
          budget={totalBudget}
        />
      </div>

      <div className="dashboard-section">
        <TopCategoriesChart
          categories={financials.topCategories}
          title="Top categories"
          showBreakdownLink={false}
        />
      </div>

      <div className="dashboard-section">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.5rem",
          }}
        >
          <h2 style={{ marginBottom: 0 }}>Transactions</h2>
          <AddToCycleButton
            cycleId={cycle.id}
            cycleStartDate={cycleStartDate}
            expenseCategoryNames={expenseCategoryNames}
            savingsCategoryNames={savingsCategoryNames}
            incomeCategoryNames={incomeCategoryNames}
          />
        </div>
        <TransactionList
          transactions={financials.transactions}
          expenseCategoryNames={expenseCategoryNames}
          savingsCategoryNames={savingsCategoryNames}
          incomeCategoryNames={incomeCategoryNames}
          cycleStartDate={cycleStartDate}
          emptyMessage="Nothing logged in this quincena."
        />
      </div>
    </div>
  );
}
