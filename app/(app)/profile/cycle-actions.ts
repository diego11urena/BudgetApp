"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  carryForwardRecurringExpenses,
  formatCycleLabel,
  getActiveIncomeSource,
  latestGoalPerCategory,
  shouldCarryForwardToCycle,
  upsertCycleIncomeEntry,
} from "@/lib/cycles";
import { nowInPanama } from "@/lib/pay-date";
import { revalidateAppPages } from "@/lib/revalidate";
import { withActionErrorHandling, type ActionResult } from "@/lib/action-error";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/get-dictionary";

const ERASE_CYCLES_RATE_LIMIT = { max: 10, windowMs: 60_000 };

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
export const eraseAllCyclesAction = withActionErrorHandling(async function eraseAllCyclesAction(): Promise<
  ActionResult | undefined
> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const t = getDictionary(await getRequestLocale());

  // Deletes + fully recreates every cycle per call -- the most expensive
  // and destructive action in the app, worth throttling on its own.
  const rateLimit = await checkRateLimit(`erase-cycles:${userId}`, ERASE_CYCLES_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return { error: t.common.tooManyAttempts(rateLimit.retryAfterSeconds) };
  }

  // Most recent target amount per recurring SAVINGS category, captured
  // before the delete below removes the cycles these targets live on.
  // EXPENSE categories don't need this capture step -- a RecurringExpense
  // already IS the current definition (not a historical snapshot), so
  // carryForwardRecurringExpenses below reads it directly post-delete.
  const recentGoals = await prisma.cycleBudgetGoal.findMany({
    where: { cycle: { userId }, expenseCategory: { recurring: true, type: "SAVINGS" } },
    include: { expenseCategory: true },
    orderBy: { createdAt: "desc" },
  });
  const latestGoalByCategory = latestGoalPerCategory(recentGoals);

  await prisma.$transaction(async (tx) => {
    await tx.budgetCycle.deleteMany({ where: { userId } });

    const now = nowInPanama();
    const cycle = await tx.budgetCycle.create({
      data: { userId, label: formatCycleLabel(now), periodStart: now },
    });

    const incomeSource = await getActiveIncomeSource(tx, userId);
    if (incomeSource) {
      await upsertCycleIncomeEntry(tx, cycle.id, incomeSource.id, incomeSource.netQuincenaAmount);
    }

    for (const goal of latestGoalByCategory.values()) {
      // Same rule closing a cycle normally applies: a MONTHLY category only
      // carries into the one quincena matching its dueDay.
      if (!shouldCarryForwardToCycle(goal.expenseCategory, now)) continue;
      await tx.cycleBudgetGoal.create({
        data: { cycleId: cycle.id, expenseCategoryId: goal.expenseCategoryId, targetAmount: goal.targetAmount },
      });
    }

    await carryForwardRecurringExpenses(tx, userId, cycle.id, now);
  });

  revalidateAppPages();
});
