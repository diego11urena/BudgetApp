"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCycleLabel, shouldCarryForwardToCycle } from "@/lib/cycles";
import { revalidateAppPages } from "@/lib/revalidate";

/**
 * Deletes every cycle for the user — cascades every transaction, budget
 * target, and income entry within them — then immediately creates a fresh
 * cycle with the current income baseline applied AND the most recent target
 * amount for every still-relevant recurring budget category carried
 * forward, mirroring what closeCycleAndStartNext does when closing a single
 * cycle. That logic reads the "previous cycle"'s targets — erasing removes
 * every cycle, so there's no previous cycle left afterward to read from,
 * which is why the recurring targets are captured *before* deleting.
 * Categories, the income source itself, and onboarding status are
 * untouched: this wipes history, not account setup. The whole thing runs in
 * one transaction so a failure partway through can't leave a fresh cycle
 * with no income entry.
 */
export async function eraseAllCyclesAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  // Most recent target amount per recurring category, captured before the
  // delete below removes the cycles these targets live on.
  const recentGoals = await prisma.cycleBudgetGoal.findMany({
    where: { cycle: { userId }, expenseCategory: { recurring: true } },
    include: { expenseCategory: true },
    orderBy: { createdAt: "desc" },
  });
  const latestGoalByCategory = new Map<string, (typeof recentGoals)[number]>();
  for (const goal of recentGoals) {
    if (!latestGoalByCategory.has(goal.expenseCategoryId)) {
      latestGoalByCategory.set(goal.expenseCategoryId, goal);
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.budgetCycle.deleteMany({ where: { userId } });

    const now = new Date();
    const cycle = await tx.budgetCycle.create({
      data: { userId, label: formatCycleLabel(now), periodStart: now },
    });

    const incomeSource = await tx.incomeSource.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: "asc" },
    });
    if (incomeSource) {
      await tx.cycleIncomeEntry.create({
        data: { cycleId: cycle.id, incomeSourceId: incomeSource.id, netAmount: incomeSource.netQuincenaAmount },
      });
    }

    for (const goal of latestGoalByCategory.values()) {
      // Same rule closing a cycle normally applies: a MONTHLY category only
      // carries into the one quincena matching its dueDay.
      if (!shouldCarryForwardToCycle(goal.expenseCategory, now)) continue;
      await tx.cycleBudgetGoal.create({
        data: { cycleId: cycle.id, expenseCategoryId: goal.expenseCategoryId, targetAmount: goal.targetAmount },
      });
    }
  });

  revalidateAppPages();
}
