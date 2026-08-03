"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { closeCycleAndStartNext } from "@/lib/cycles";
import { getCycleBudgetGoals } from "@/lib/budget-goals";

export interface CycleClosedSummary {
  spent: number;
  saved: number;
  /** Income minus expenses minus savings — what's left from that quincena. */
  rolledOver: number;
  topCategory: { name: string; amount: number } | null;
  budget: { hasBudget: boolean; overBy: number };
}

export async function justGotPaidAction(): Promise<CycleClosedSummary> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { closedCycle, closedCycleFinancials } = await closeCycleAndStartNext(session.user.id);
  const goals = await getCycleBudgetGoals(closedCycle.id, "EXPENSE");
  const totalBudget = goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
  const top = closedCycleFinancials.topCategories[0];

  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/budget");
  revalidatePath("/goals");

  return {
    spent: closedCycleFinancials.totalExpenses,
    saved: closedCycleFinancials.totalSavings,
    rolledOver: closedCycleFinancials.amountLeft,
    topCategory: top ? { name: top.categoryName, amount: top.amount } : null,
    budget: {
      hasBudget: goals.length > 0,
      overBy: Math.max(closedCycleFinancials.totalExpenses - totalBudget, 0),
    },
  };
}
