import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftCycle, formatCycleRangeText } from "@/lib/cycles";
import { getOrderedCategoryNames } from "@/lib/category-order";
import { getRecurringExpensesForCycle } from "@/lib/recurring-expenses";
import { RecurringExpensesPanel } from "./_components/RecurringExpensesPanel";

export const metadata: Metadata = { title: "Recurring Expenses" };

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
  const categories = await getRecurringExpensesForCycle(userId, cycle.id);
  const expenseCategoryNames = await getOrderedCategoryNames(userId, cycle.id, "EXPENSE");

  return (
    <div className="home-page">
      <h1 className="page-title">Recurring Expenses</h1>

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
