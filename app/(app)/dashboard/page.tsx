import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMostRecentClosedCycle, getOrCreateDraftCycle, getRecentCycles } from "@/lib/cycles";
import { getCycleFinancials, summarizeCycleFinancials, sumFixedTargetSpend } from "@/lib/cycle-financials";
import { getOrderedCategoryNames } from "@/lib/category-order";
import { getCycleBudgetGoals } from "@/lib/budget-goals";
import { generateInsights } from "@/lib/insights";
import { formatCycleLabel } from "@/lib/pay-date";
import Link from "next/link";
import { Header } from "./_components/Header";
import { HeroCard } from "./_components/HeroCard";
import { BudgetBreakdownCard } from "./_components/BudgetBreakdownCard";
import { TopCategoriesChart } from "./_components/TopCategoriesChart";
import { InsightsCard } from "./_components/InsightsCard";
import { LastPaycheckBanner } from "./_components/LastPaycheckBanner";
import { UncategorizedImportsBanner } from "./_components/UncategorizedImportsBanner";
import { TransactionList } from "../_components/TransactionList";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const cycle = await getOrCreateDraftCycle(userId);
  const financials = await getCycleFinancials(cycle.id);
  const expenseGoals = await getCycleBudgetGoals(cycle.id, "EXPENSE");
  const totalBudget = expenseGoals.reduce((sum, goal) => sum + goal.targetAmount, 0);
  const fixedSpent = sumFixedTargetSpend(
    financials.categoryTotals,
    expenseGoals.map((goal) => goal.categoryId),
  );

  const [expenseCategoryNames, savingsCategoryNames] = await Promise.all([
    getOrderedCategoryNames(userId, cycle.id, "EXPENSE"),
    getOrderedCategoryNames(userId, cycle.id, "SAVINGS"),
  ]);

  const lastClosedCycle = await getMostRecentClosedCycle(userId);
  const lastClosedFinancials = lastClosedCycle
    ? await getCycleFinancials(lastClosedCycle.id)
    : null;

  const recentCycles = await getRecentCycles(userId);
  const closedCycles = recentCycles.filter((c) => c.status === "CLOSED" && c.id !== cycle.id);
  const previousClosedFinancials = closedCycles.map((c) =>
    summarizeCycleFinancials(c.incomeEntries, c.transactions),
  );

  const insights = generateInsights(financials, previousClosedFinancials);

  // Any transaction with no real category yet — most commonly a Gmail
  // import with no merchant-learning match (see findLearnedCategoryId in
  // lib/gmail-sync.ts), but this catches a null category regardless of how
  // it got that way. Surfaced here so it doesn't just sit uncategorized and
  // skew "Top categories"/"Fixed budget used" forever. Scoped to the
  // current cycle only, consistent with the rest of this page. INCOME is
  // excluded since it never has a category concept to begin with.
  const uncategorizedTransactions = (
    await prisma.cycleTransaction.findMany({
      where: {
        cycleId: cycle.id,
        expenseCategoryId: null,
        type: { not: "INCOME" },
      },
      select: { id: true, name: true, amount: true },
      orderBy: { occurredAt: "desc" },
    })
  ).map((t) => ({ id: t.id, name: t.name, amount: t.amount.toNumber() }));

  return (
    <div className="home-page">
      <Header
        name={session.user.name}
        currentPayAmount={financials.baseIncome}
        currentPayDate={formatCycleLabel(cycle.periodStart)}
      />

      {uncategorizedTransactions.length > 0 && (
        <div className="dashboard-section dashboard-section--plain">
          <UncategorizedImportsBanner
            transactions={uncategorizedTransactions}
            categoryNames={expenseCategoryNames}
          />
        </div>
      )}

      {lastClosedFinancials && (
        <div className="dashboard-section dashboard-section--plain">
          <LastPaycheckBanner amountLeft={lastClosedFinancials.amountLeft} />
        </div>
      )}

      <div className="dashboard-section dashboard-section--plain">
        <HeroCard
          amountLeft={financials.amountLeft}
          periodStart={cycle.periodStart}
          totalExpenses={financials.totalExpenses}
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
        <TopCategoriesChart categories={financials.topCategories} />
      </div>

      <div className="dashboard-section">
        <h2>Recent transactions</h2>
        <TransactionList
          transactions={financials.transactions.slice(0, 3)}
          expenseCategoryNames={expenseCategoryNames}
          savingsCategoryNames={savingsCategoryNames}
          cycleStartDate={formatCycleLabel(cycle.periodStart)}
        />
        {financials.transactions.length > 3 && (
          <Link href="/transactions" className="line-item line-item--link">
            See all →
          </Link>
        )}
      </div>

      <div className="dashboard-section dashboard-section--plain">
        <InsightsCard insights={insights} />
      </div>
    </div>
  );
}
