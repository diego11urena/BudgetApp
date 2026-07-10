import { prisma } from "@/lib/prisma";
import type { BudgetCycle } from "@/app/generated/prisma/client";

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** "YYYY-MM" label for the given date's calendar month. */
export function currentCycleLabel(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function monthBounds(date: Date): { periodStart: Date; periodEnd: Date } {
  const periodStart = new Date(date.getFullYear(), date.getMonth(), 1);
  const periodEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { periodStart, periodEnd };
}

/**
 * Returns the current calendar month's budget cycle for a user, creating it
 * (as DRAFT) if it doesn't exist yet. Onboarding writes progressively into
 * this same cycle's related rows.
 */
export async function getOrCreateDraftCycle(userId: string): Promise<BudgetCycle> {
  const now = new Date();
  const label = currentCycleLabel(now);

  const existing = await prisma.budgetCycle.findUnique({
    where: { userId_label: { userId, label } },
  });
  if (existing) return existing;

  const { periodStart, periodEnd } = monthBounds(now);

  return prisma.budgetCycle.create({
    data: { userId, label, periodStart, periodEnd },
  });
}

/** The user's most recent cycles, newest first. Retains all history — never deletes. */
export function getRecentCycles(userId: string, limit = 5) {
  return prisma.budgetCycle.findMany({
    where: { userId },
    orderBy: { periodStart: "desc" },
    take: limit,
    include: {
      incomeEntries: true,
      budgetGoals: { include: { expenseCategory: true } },
      accountBalances: { include: { financialAccount: true } },
    },
  });
}
