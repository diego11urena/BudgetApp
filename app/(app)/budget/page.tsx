import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import { getCycleFinancials } from "@/lib/cycle-financials";
import { getOrderedCategoryNames } from "@/lib/category-order";
import { getCycleBudgetGoals } from "@/lib/budget-goals";
import { BudgetGoalForm } from "./_components/BudgetGoalForm";
import { BudgetGoalRow } from "./_components/BudgetGoalRow";

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
        <p className="field-hint" style={{ marginBottom: "0.75rem" }}>
          Recurring targets carry into every quincena by default — expand a
          target to switch it to a specific day each month instead.
        </p>
        {rows.length === 0 && (
          <p className="field-hint">No budget categories yet — add one below.</p>
        )}
        <div className="budget-goal-list">
          {rows.map((row) => (
            <BudgetGoalRow
              key={row.id}
              goalId={row.id}
              categoryId={row.categoryId}
              categoryName={row.categoryName}
              actual={row.actual}
              targetAmount={row.targetAmount}
              recurring={row.recurring}
              frequency={row.frequency}
              dueDay={row.dueDay}
            />
          ))}
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
