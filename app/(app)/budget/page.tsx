import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrCreateDraftCycle, formatCycleRangeText } from "@/lib/cycles";
import { getCycleFinancials } from "@/lib/cycle-financials";
import { getOrderedCategoryNames } from "@/lib/category-order";
import { getCycleBudgetGoals } from "@/lib/budget-goals";
import { BudgetGoalsPanel } from "./_components/BudgetGoalsPanel";

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
      {/* No page <h1> here on purpose -- the bottom-nav tab already reads
          "Fixed Expenses"; a repeated page title added no information. */}
      <p className="field-hint" style={{ marginBottom: "1rem" }}>
        Fixed expenses for this quincena. Savings goals live on the Goals tab.
      </p>

      <div className="dashboard-section">
        <BudgetGoalsPanel
          rows={rows}
          categoryNames={expenseCategoryNames}
          dateRangeText={formatCycleRangeText(cycle, { includeYear: false })}
        />
      </div>
    </div>
  );
}
