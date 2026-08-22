import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftCycle, formatCycleRangeText } from "@/lib/cycles";
import { getCycleFinancials } from "@/lib/cycle-financials";
import { getOrderedCategoryNames } from "@/lib/category-order";
import { getRecurringExpensesForCycle } from "@/lib/recurring-expenses";
import { RecurringExpensesPanel } from "./_components/RecurringExpensesPanel";

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
  const categories = await getRecurringExpensesForCycle(userId, cycle.id, financials.categoryTotals);
  const expenseCategoryNames = await getOrderedCategoryNames(userId, cycle.id, "EXPENSE");

  return (
    <div className="home-page">
      <h1 className="page-title">Recurring Expenses</h1>
      <p className="field-hint" style={{ marginBottom: "1rem" }}>
        Track recurring bills and subscriptions for this quincena. Savings goals live on the Goals
        tab.
      </p>

      <div className="dashboard-section">
        <RecurringExpensesPanel
          categories={categories}
          categoryNames={expenseCategoryNames}
          dateRangeText={formatCycleRangeText(cycle, { includeYear: false })}
          hasSeenHint={Boolean(user?.seenFixedExpenseHintAt)}
        />
      </div>
    </div>
  );
}
