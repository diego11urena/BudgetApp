import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMostRecentClosedCycle, getOrCreateDraftCycle, getRecentCycles } from "@/lib/cycles";
import { getCycleFinancials, summarizeCycleFinancials } from "@/lib/cycle-financials";
import { getOrderedCategoryNames } from "@/lib/category-order";
import { getCycleBudgetGoals } from "@/lib/budget-goals";
import { generateInsights } from "@/lib/insights";
import { IMPORT_CATEGORY_NAME, YAPPY_CATEGORY_NAME } from "@/lib/gmail-sync";
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

  // Gmail-imported transactions still sitting in a system bucket because
  // no merchant-learning match was found (see findLearnedCategoryId in
  // lib/gmail-sync.ts) — surfaced here so they don't just sit uncategorized
  // and skew "Top categories" forever. Scoped to the current cycle only,
  // consistent with the rest of this page.
  const uncategorizedImports = (
    await prisma.cycleTransaction.findMany({
      where: {
        cycleId: cycle.id,
        expenseCategory: { name: { in: [IMPORT_CATEGORY_NAME, YAPPY_CATEGORY_NAME] } },
      },
      select: { id: true, name: true, amount: true },
      orderBy: { occurredAt: "desc" },
    })
  ).map((t) => ({ id: t.id, name: t.name, amount: t.amount.toNumber() }));

  return (
    <div className="home-page">
      <Header name={session.user.name} />

      {uncategorizedImports.length > 0 && (
        <div className="dashboard-section dashboard-section--plain">
          <UncategorizedImportsBanner
            transactions={uncategorizedImports}
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
          spent={financials.totalExpenses}
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
