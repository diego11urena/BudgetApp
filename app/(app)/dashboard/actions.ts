"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { closeCycleAndStartNext, getOrCreateDraftCycle } from "@/lib/cycles";
import { getCycleBudgetGoals } from "@/lib/budget-goals";
import { decimalString } from "@/lib/validations/shared";
import { revalidateAppPages } from "@/lib/revalidate";

export interface CycleClosedSummary {
  spent: number;
  saved: number;
  /** Income minus expenses minus savings — what's left from that quincena. */
  rolledOver: number;
  topCategory: { name: string; amount: number } | null;
  budget: { hasBudget: boolean; overBy: number };
  /** The amount auto-carried into the new cycle — prefills the "how much did you get paid?" prompt. */
  carriedIncomeAmount: number;
}

export async function justGotPaidAction(): Promise<CycleClosedSummary> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { closedCycle, newCycle, closedCycleFinancials } = await closeCycleAndStartNext(
    session.user.id,
  );
  const [goals, carriedEntry] = await Promise.all([
    getCycleBudgetGoals(closedCycle.id, "EXPENSE"),
    prisma.cycleIncomeEntry.findFirst({ where: { cycleId: newCycle.id } }),
  ]);
  const totalBudget = goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
  const top = closedCycleFinancials.topCategories[0];

  revalidateAppPages();

  return {
    spent: closedCycleFinancials.totalExpenses,
    saved: closedCycleFinancials.totalSavings,
    rolledOver: closedCycleFinancials.amountLeft,
    topCategory: top ? { name: top.categoryName, amount: top.amount } : null,
    budget: {
      hasBudget: goals.length > 0,
      overBy: Math.max(closedCycleFinancials.totalExpenses - totalBudget, 0),
    },
    carriedIncomeAmount: carriedEntry?.netAmount.toNumber() ?? 0,
  };
}

export type ConfirmNewCycleIncomeResult = { error?: string } | undefined;

/**
 * Sets this quincena's actual paycheck amount, prompted right after closing
 * the previous cycle (rather than only editable via Profile) — pay varies
 * quincena to quincena, so this is asked every time instead of silently
 * reusing whatever was set last. Updates IncomeSource.netQuincenaAmount too,
 * so it becomes the new baseline (and what the *next* prompt prefills).
 */
export async function confirmNewCycleIncomeAction(
  formData: FormData,
): Promise<ConfirmNewCycleIncomeResult> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const parsed = decimalString.safeParse(formData.get("netQuincenaAmount"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid amount" };
  }
  const netQuincenaAmount = parsed.data;

  const incomeSource = await prisma.incomeSource.findFirst({
    where: { userId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (!incomeSource) {
    return { error: "No income source found yet — complete onboarding first." };
  }

  const cycle = await getOrCreateDraftCycle(userId);
  const existingEntry = await prisma.cycleIncomeEntry.findFirst({
    where: { cycleId: cycle.id, incomeSourceId: incomeSource.id },
  });

  await prisma.$transaction([
    prisma.incomeSource.update({ where: { id: incomeSource.id }, data: { netQuincenaAmount } }),
    existingEntry
      ? prisma.cycleIncomeEntry.update({
          where: { id: existingEntry.id },
          data: { netAmount: netQuincenaAmount },
        })
      : prisma.cycleIncomeEntry.create({
          data: { cycleId: cycle.id, incomeSourceId: incomeSource.id, netAmount: netQuincenaAmount },
        }),
  ]);

  revalidateAppPages();
}
