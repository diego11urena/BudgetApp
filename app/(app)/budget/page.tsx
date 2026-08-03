import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import { getCycleFinancials } from "@/lib/cycle-financials";
import { getOrderedCategoryNames } from "@/lib/category-order";
import { getCycleBudgetGoals } from "@/lib/budget-goals";
import { getBudgetUsage } from "@/lib/budget-status";
import { formatCurrency } from "@/lib/format";
import { iconForCategoryName } from "@/lib/category-icons";
import { ProgressBar } from "../_components/ProgressBar";
import { BudgetGoalForm } from "./_components/BudgetGoalForm";
import { RecurringToggle } from "./_components/RecurringToggle";
import { RecurringFrequencyControl } from "./_components/RecurringFrequencyControl";
import { DeleteBudgetGoalButton } from "./_components/DeleteBudgetGoalButton";

export default async function BudgetPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const cycle = await getOrCreateDraftCycle(userId);
  const financials = await getCycleFinancials(cycle.id);
  const goals = await getCycleBudgetGoals(cycle.id, "EXPENSE");
  const expenseCategoryNames = await getOrderedCategoryNames(userId, cycle.id, "EXPENSE");

  const rows = goals.map((goal) => ({
    ...goal,
    actual: financials.categoryTotals.find((c) => c.categoryId === goal.categoryId)?.amount ?? 0,
  }));

  return (
    <div className="home-page">
      <h1 className="page-title">Budget</h1>
      <p className="field-hint" style={{ marginBottom: "1rem" }}>
        Fixed expense targets for this quincena. Savings targets live on the Goals tab.
      </p>

      <div className="dashboard-section">
        <h2>This quincena&apos;s budget</h2>
        {rows.length === 0 && (
          <p className="field-hint">No budget categories yet — add one below.</p>
        )}
        <div className="budget-goal-list">
          {rows.map((row) => {
            const usage = getBudgetUsage(row.actual, row.targetAmount);
            return (
              <div className="budget-goal-row" key={row.id}>
                <div className="progress-bar-label">
                  <span>
                    {iconForCategoryName(row.categoryName)} {row.categoryName}
                  </span>
                  <span>{usage.percentage}%</span>
                </div>
                <ProgressBar current={row.actual} target={row.targetAmount} colorState={usage.state} />
                <p className="field-hint" style={{ marginTop: "0.35rem" }}>
                  {formatCurrency(row.actual)} / {formatCurrency(row.targetAmount)}
                  {usage.overBy > 0 && (
                    <span className="overage-text"> · {formatCurrency(usage.overBy)} over</span>
                  )}
                </p>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginTop: "0.5rem",
                  }}
                >
                  <RecurringToggle categoryId={row.categoryId} recurring={row.recurring} />
                  <DeleteBudgetGoalButton goalId={row.id} categoryName={row.categoryName} />
                </div>
                {row.recurring && (
                  <RecurringFrequencyControl
                    categoryId={row.categoryId}
                    frequency={row.frequency}
                    dueDay={row.dueDay}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Add or update a target</h2>
        <p className="field-hint" style={{ marginBottom: "0.75rem" }}>
          Sets this quincena&apos;s amount. New categories start Recurring — tap the 🔁 badge on
          a target above to stop it from carrying into your next quincena.
        </p>
        <BudgetGoalForm categoryNames={expenseCategoryNames} />
      </div>
    </div>
  );
}
