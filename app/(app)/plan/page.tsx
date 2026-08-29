import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import { getOrderedCategoryNames } from "@/lib/category-order";
import { getRecurringExpensesForCycle } from "@/lib/recurring-expenses";
import { getGoalsWithProgress } from "@/lib/goals";
import { BillsSection } from "./_components/BillsSection";
import { GoalsSection } from "./_components/GoalsSection";

export const metadata: Metadata = { title: "Plan" };

/**
 * Bills (was /budget, "Recurring Expenses") and Goals (was /goals) merged
 * onto one screen -- see the Balboa fix list's batch 11.3/11.5. Both
 * answer "what did I plan to do with this paycheck," both are checked
 * often but edited rarely (once or twice a month for bills, once for
 * goals), and splitting them cost two of the app's five nav slots for
 * that low a change frequency.
 */
export default async function PlanPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const cycle = await getOrCreateDraftCycle(userId);
  const [billCategories, expenseCategoryNames, goals, savingsCategoryNames] = await Promise.all([
    getRecurringExpensesForCycle(userId, cycle.id),
    getOrderedCategoryNames(userId, cycle.id, "EXPENSE"),
    getGoalsWithProgress(userId, cycle.id),
    getOrderedCategoryNames(userId, cycle.id, "SAVINGS"),
  ]);

  return (
    <div className="home-page">
      <h1 className="page-title">Plan</h1>

      <div className="dashboard-section">
        <GoalsSection goals={goals} savingsCategoryNames={savingsCategoryNames} />
      </div>

      <div className="dashboard-section">
        <BillsSection categories={billCategories} categoryNames={expenseCategoryNames} />
      </div>
    </div>
  );
}
