import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import { getCycleFinancials } from "@/lib/cycle-financials";
import { getOrderedCategoryNames } from "@/lib/category-order";
import { getCycleBudgetGoals } from "@/lib/budget-goals";
import { AddTargetSheet } from "./_components/AddTargetSheet";
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
      <h1 className="page-title">Fixed Expenses</h1>
      <p className="field-hint" style={{ marginBottom: "1rem" }}>
        Fixed expense targets for this quincena. Savings targets live on the Goals tab.
      </p>

      <div className="dashboard-section">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "0.5rem",
          }}
        >
          <h2 style={{ marginBottom: 0 }}>This quincena&apos;s fixed expenses</h2>
          <AddTargetSheet categoryNames={expenseCategoryNames} />
        </div>
        <p className="field-hint" style={{ marginBottom: "0.75rem" }}>
          Recurring targets carry into every quincena by default — tap the
          edit icon on a target to switch it to a specific day each month
          instead.
        </p>
        {rows.length === 0 && (
          <p className="field-hint">No fixed expense targets yet — tap &quot;+ Add target&quot; above.</p>
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
    </div>
  );
}
