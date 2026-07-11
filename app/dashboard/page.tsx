import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrCreateDraftCycle, getRecentCycles } from "@/lib/cycles";
import { getCycleFinancials } from "@/lib/cycle-financials";
import { AmountLeftCard } from "./_components/AmountLeftCard";
import { TopCategoriesChart } from "./_components/TopCategoriesChart";
import { TransactionForm } from "./_components/TransactionForm";
import { TransactionList } from "./_components/TransactionList";
import { resetOnboardingAction } from "./dev-actions";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const cycle = await getOrCreateDraftCycle(session.user.id);
  const financials = await getCycleFinancials(cycle.id);
  const recentCycles = await getRecentCycles(session.user.id);

  return (
    <div className="page-center">
      <div className="card card--dashboard">
        <h1>{cycle.label}</h1>

        <div className="dashboard-section">
          <AmountLeftCard
            amountLeft={financials.amountLeft}
            baseIncome={financials.baseIncome}
            extraIncome={financials.extraIncome}
            totalExpenses={financials.totalExpenses}
            totalSavings={financials.totalSavings}
          />
        </div>

        <div className="dashboard-section">
          <TopCategoriesChart categories={financials.topCategories} />
        </div>

        <div className="dashboard-section">
          <h2>Log a transaction</h2>
          <TransactionForm />
        </div>

        <div className="dashboard-section">
          <h2>This cycle</h2>
          <TransactionList transactions={financials.transactions} />
        </div>

        <div className="dashboard-section">
          <h2>History</h2>
          <div className="preview-box">
            {recentCycles.map((c) => (
              <div className="line-item" key={c.id}>
                <span>
                  {c.label} ({c.status})
                </span>
                <span>
                  {c.incomeEntries.length} income · {c.budgetGoals.length} goals
                </span>
              </div>
            ))}
          </div>
        </div>

        {process.env.NODE_ENV !== "production" && (
          <div className="dashboard-section">
            <form action={resetOnboardingAction}>
              <button type="submit" className="button button--secondary">
                Reset onboarding (dev only)
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
