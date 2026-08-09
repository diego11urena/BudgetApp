import { prisma } from "@/lib/prisma";
import { getCycleFinancials, type CycleFinancials } from "@/lib/cycle-financials";
import type { BudgetCycle } from "@/app/generated/prisma/client";

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** "YYYY-MM-DD" label for the given date — a cycle's start date, for display. */
export function formatCycleLabel(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export type Quincena = "FIRST" | "SECOND";

/** On/before the 15th of the month -> the first quincena; after -> the second. */
export function quincenaForDay(day: number): Quincena {
  return day <= 15 ? "FIRST" : "SECOND";
}

/**
 * Whether a recurring category's most recent budget target should carry
 * forward into a newly-created cycle. BIWEEKLY carries into every cycle —
 * once per quincena, by definition. MONTHLY carries into exactly one
 * quincena per month: whichever one dueDay falls in, matched against which
 * quincena the new cycle itself is (by its own periodStart's day-of-month).
 */
export function shouldCarryForwardToCycle(
  rule: { frequency: "BIWEEKLY" | "MONTHLY"; dueDay: number | null },
  newCyclePeriodStart: Date,
): boolean {
  if (rule.frequency === "BIWEEKLY") return true;
  if (rule.dueDay === null) return false;
  return quincenaForDay(rule.dueDay) === quincenaForDay(newCyclePeriodStart.getDate());
}

/**
 * Returns the user's current open (DRAFT or ACTIVE) cycle, creating one if
 * none exists yet. Onboarding writes progressively into this same cycle's
 * related rows. A cycle is a paycheck period, not a calendar month — it
 * stays open until explicitly closed via closeCycleAndStartNext, however
 * often that happens (e.g. twice a month for semi-monthly pay).
 */
export async function getOrCreateDraftCycle(userId: string): Promise<BudgetCycle> {
  const existing = await prisma.budgetCycle.findFirst({
    where: { userId, status: { in: ["DRAFT", "ACTIVE"] } },
    orderBy: { periodStart: "desc" },
  });
  if (existing) return existing;

  const now = new Date();
  return prisma.budgetCycle.create({
    data: { userId, label: formatCycleLabel(now), periodStart: now },
  });
}

/** The user's most recently closed cycle, if any — for a "last paycheck" summary. */
export function getMostRecentClosedCycle(userId: string) {
  return prisma.budgetCycle.findFirst({
    where: { userId, status: "CLOSED" },
    orderBy: { periodEnd: "desc" },
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
      transactions: { include: { expenseCategory: true } },
    },
  });
}

export interface CloseCycleResult {
  closedCycle: BudgetCycle;
  newCycle: BudgetCycle;
  closedCycleFinancials: CycleFinancials;
}

/**
 * "Just got paid": closes the current open cycle and starts the next one,
 * carrying forward the recurring setup (income, fixed-expense and savings
 * targets) so the user never has to redo onboarding-style setup for a new
 * paycheck. Logged transactions do NOT carry forward — the closed cycle
 * keeps its own transaction history forever, exactly as it was.
 */
export async function closeCycleAndStartNext(userId: string): Promise<CloseCycleResult> {
  const currentCycle = await getOrCreateDraftCycle(userId);
  const closedCycleFinancials = await getCycleFinancials(currentCycle.id);

  const now = new Date();

  const { closed: closedCycle, created: newCycle } = await prisma.$transaction(async (tx) => {
    const closed = await tx.budgetCycle.update({
      where: { id: currentCycle.id },
      data: { status: "CLOSED", periodEnd: now },
    });

    const created = await tx.budgetCycle.create({
      data: {
        userId,
        label: formatCycleLabel(now),
        periodStart: now,
        status: "ACTIVE",
      },
    });

    const incomeSource = await tx.incomeSource.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: "asc" },
    });

    if (incomeSource) {
      await tx.cycleIncomeEntry.create({
        data: {
          cycleId: created.id,
          incomeSourceId: incomeSource.id,
          netAmount: incomeSource.netQuincenaAmount,
        },
      });
    }

    // Only categories marked recurring auto-carry their most recent target
    // into the new cycle — a category's own setting, independent of any
    // one cycle's targetAmount (which is never rewritten by this). Which
    // *cycles* a category carries into is a separate decision (see
    // shouldCarryForwardToCycle): BIWEEKLY carries into all of them, MONTHLY
    // only into the one quincena matching its dueDay.
    const previousGoals = await tx.cycleBudgetGoal.findMany({
      where: { cycleId: closed.id, expenseCategory: { recurring: true } },
      include: { expenseCategory: true },
    });

    for (const goal of previousGoals) {
      if (!shouldCarryForwardToCycle(goal.expenseCategory, created.periodStart)) continue;

      // upsert, not create: makes this idempotent against a retry of this
      // transaction, so a rule can never end up with two CycleBudgetGoal
      // rows for the same new cycle.
      await tx.cycleBudgetGoal.upsert({
        where: {
          cycleId_expenseCategoryId: { cycleId: created.id, expenseCategoryId: goal.expenseCategoryId },
        },
        create: {
          cycleId: created.id,
          expenseCategoryId: goal.expenseCategoryId,
          targetAmount: goal.targetAmount,
        },
        update: {},
      });
    }

    return { closed, created };
  });

  return { closedCycle, newCycle, closedCycleFinancials };
}
