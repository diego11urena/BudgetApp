import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getMostRecentClosedCycle, getOrCreateDraftCycle, getRecentCycles } from "@/lib/cycles";
import {
  getCycleFinancials,
  getLastUsedIncomeName,
  summarizeCycleFinancials,
} from "@/lib/cycle-financials";
import { getOrderedCategoryNames } from "@/lib/category-order";
import { getCycleBudgetGoals } from "@/lib/budget-goals";
import { generateInsights } from "@/lib/insights";
import { formatUSD } from "@/lib/format";
import { Header } from "./_components/Header";
import { HeroCard } from "./_components/HeroCard";
import { BudgetProgressCard } from "./_components/BudgetProgressCard";
import { SummaryRow } from "./_components/SummaryRow";
import { TopCategoriesChart } from "./_components/TopCategoriesChart";
import { QuickActions } from "./_components/QuickActions";
import { InsightsCard } from "./_components/InsightsCard";
import { LastPaycheckBanner } from "./_components/LastPaycheckBanner";
import { TransactionForm } from "../_components/TransactionForm";
import { TransactionList } from "../_components/TransactionList";

type TxType = "EXPENSE" | "INCOME" | "SAVINGS";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const { type } = await searchParams;
  const initialType: TxType = type === "INCOME" || type === "SAVINGS" ? type : "EXPENSE";

  const cycle = await getOrCreateDraftCycle(userId);
  const financials = await getCycleFinancials(cycle.id);
  const expenseGoals = await getCycleBudgetGoals(cycle.id, "EXPENSE");
  const totalBudget = expenseGoals.reduce((sum, goal) => sum + goal.targetAmount, 0);

  const [expenseCategoryNames, savingsCategoryNames, lastUsedIncomeName] = await Promise.all([
    getOrderedCategoryNames(userId, cycle.id, "EXPENSE"),
    getOrderedCategoryNames(userId, cycle.id, "SAVINGS"),
    getLastUsedIncomeName(userId),
  ]);

  const lastClosedCycle = await getMostRecentClosedCycle(userId);
  const lastClosedFinancials = lastClosedCycle
    ? await getCycleFinancials(lastClosedCycle.id)
    : null;

  const recentCycles = await getRecentCycles(userId);
  const previousClosedFinancials = recentCycles
    .filter((c) => c.status === "CLOSED" && c.id !== cycle.id)
    .map((c) => summarizeCycleFinancials(c.incomeEntries, c.transactions));

  const insights = generateInsights(financials, previousClosedFinancials);

  return (
    <div className="home-page">
      <Header name={session.user.name} />

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
        <BudgetProgressCard spent={financials.totalExpenses} budget={totalBudget} />
      </div>

      <div className="dashboard-section">
        <SummaryRow
          income={financials.baseIncome + financials.extraIncome}
          expenses={financials.totalExpenses}
          saved={financials.totalSavings}
        />
      </div>

      <div className="dashboard-section">
        <TopCategoriesChart categories={financials.topCategories} />
      </div>

      <div className="dashboard-section">
        <h2>Recent transactions</h2>
        <TransactionList transactions={financials.transactions.slice(0, 5)} />
      </div>

      <div className="dashboard-section dashboard-section--plain">
        <QuickActions
          expenseCategoryNames={expenseCategoryNames}
          savingsCategoryNames={savingsCategoryNames}
          lastUsedIncomeName={lastUsedIncomeName}
        />
      </div>

      <div className="dashboard-section">
        <h2>Log a transaction</h2>
        <TransactionForm
          key={initialType}
          initialType={initialType}
          expenseCategoryNames={expenseCategoryNames}
          savingsCategoryNames={savingsCategoryNames}
        />
      </div>

      <div className="dashboard-section dashboard-section--plain">
        <InsightsCard insights={insights} />
      </div>

      <div className="dashboard-section">
        <h2>History</h2>
        <div className="preview-box">
          {recentCycles.map((c) => {
            const cFinancials = summarizeCycleFinancials(c.incomeEntries, c.transactions);
            return (
              <div className="line-item" key={c.id}>
                <span>
                  {c.label} ({c.status})
                </span>
                <span>{formatUSD(cFinancials.amountLeft)} left</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
