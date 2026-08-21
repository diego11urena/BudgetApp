import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  const [cycle, user] = await Promise.all([
    getOrCreateDraftCycle(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { seenFixedExpenseHintAt: true } }),
  ]);
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
        Fixed expenses for this quincena. Savings goals live on the Goals tab.
      </p>

      <div className="dashboard-section">
        <BudgetGoalsPanel
          rows={rows}
          categoryNames={expenseCategoryNames}
          dateRangeText={formatCycleRangeText(cycle, { includeYear: false })}
          hasSeenHint={Boolean(user?.seenFixedExpenseHintAt)}
          cycleId={cycle.id}
        />
      </div>
    </div>
  );
}
