import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import { getCycleFinancials } from "@/lib/cycle-financials";
import { getCycleBudgetGoals } from "@/lib/budget-goals";
import { formatUSD } from "@/lib/format";
import { iconForCategoryName } from "@/lib/category-icons";
import { ProgressBar } from "../_components/ProgressBar";
import { BudgetGoalForm } from "./_components/BudgetGoalForm";
import { deleteBudgetGoalAction } from "./actions";

export default async function BudgetPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const cycle = await getOrCreateDraftCycle(userId);
  const financials = await getCycleFinancials(cycle.id);
  const goals = await getCycleBudgetGoals(cycle.id, "EXPENSE");
  const expenseCategories = await prisma.expenseCategory.findMany({
    where: { userId, type: "EXPENSE" },
    select: { name: true },
  });

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
          {rows.map((row) => (
            <div className="budget-goal-row" key={row.id}>
              <div className="progress-bar-label">
                <span>
                  {iconForCategoryName(row.categoryName)} {row.categoryName}
                </span>
                <span>
                  {formatUSD(row.actual)} / {formatUSD(row.targetAmount)}
                </span>
              </div>
              <ProgressBar current={row.actual} target={row.targetAmount} />
              <form action={deleteBudgetGoalAction} style={{ marginTop: "0.5rem" }}>
                <input type="hidden" name="goalId" value={row.id} />
                <button
                  type="submit"
                  className="icon-button"
                  aria-label={`Remove ${row.categoryName} budget`}
                >
                  Remove
                </button>
              </form>
            </div>
          ))}
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Add or update a target</h2>
        <p className="field-hint" style={{ marginBottom: "0.75rem" }}>
          This quincena&apos;s target only — won&apos;t affect future quincenas until you edit
          those too.
        </p>
        <BudgetGoalForm categoryNames={expenseCategories.map((c) => c.name)} />
      </div>
    </div>
  );
}
