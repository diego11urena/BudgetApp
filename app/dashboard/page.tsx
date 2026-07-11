import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getMostRecentClosedCycle, getOrCreateDraftCycle, getRecentCycles } from "@/lib/cycles";
import { getCycleFinancials, summarizeCycleFinancials } from "@/lib/cycle-financials";
import { AmountLeftCard } from "./_components/AmountLeftCard";
import { TopCategoriesChart } from "./_components/TopCategoriesChart";
import { TransactionForm } from "./_components/TransactionForm";
import { TransactionList } from "./_components/TransactionList";
import { LastPaycheckBanner } from "./_components/LastPaycheckBanner";
import { justGotPaidAction } from "./actions";
import { resetOnboardingAction } from "./dev-actions";

function formatCycleHeading(periodStart: Date): string {
  return `Cycle since ${periodStart.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })}`;
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const cycle = await getOrCreateDraftCycle(userId);
  const financials = await getCycleFinancials(cycle.id);
  const recentCycles = await getRecentCycles(userId);
  const lastClosedCycle = await getMostRecentClosedCycle(userId);
  const lastClosedFinancials = lastClosedCycle
    ? await getCycleFinancials(lastClosedCycle.id)
    : null;

  return (
    <div className="page-center">
      <div className="card card--dashboard">
        <h1>{formatCycleHeading(cycle.periodStart)}</h1>

        {lastClosedFinancials && (
          <div className="dashboard-section">
            <LastPaycheckBanner amountLeft={lastClosedFinancials.amountLeft} />
          </div>
        )}

        <div className="dashboard-section">
          <form action={justGotPaidAction}>
            <button type="submit" className="button">
              I just got paid
            </button>
          </form>
        </div>

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
            {recentCycles.map((c) => {
              const cFinancials = summarizeCycleFinancials(c.incomeEntries, c.transactions);
              return (
                <div className="line-item" key={c.id}>
                  <span>
                    {c.label} ({c.status})
                  </span>
                  <span>
                    {cFinancials.amountLeft.toLocaleString("en-US", {
                      style: "currency",
                      currency: "USD",
                    })}{" "}
                    left
                  </span>
                </div>
              );
            })}
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
