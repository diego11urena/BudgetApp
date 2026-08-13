import { prisma } from "@/lib/prisma";
import { getCycleFinancials, type CycleFinancials } from "@/lib/cycle-financials";
import type { BudgetCycle, Prisma, PrismaClient } from "@/app/generated/prisma/client";
import { formatCycleLabel, parsePayDate } from "@/lib/pay-date";

type Db = PrismaClient | Prisma.TransactionClient;

// Re-exported so every existing "@/lib/cycles" call site keeps working
// unchanged — these two now live in lib/pay-date.ts (a Prisma-free module)
// so ConfirmJustGotPaidSheet, a client component, can import them directly
// without pulling this file's server-only dependencies into the browser.
export { formatCycleLabel, parsePayDate };

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
 * Given goals ordered newest-first (createdAt desc), keeps only the most
 * recent one per expenseCategoryId. Used when recreating recurring budget
 * targets on a brand-new cycle that has no single "previous cycle" to read
 * from (e.g. erasing all cycles) — pulled out as its own pure function so
 * the dedup-by-newest rule is unit-testable without a database.
 */
export function latestGoalPerCategory<T extends { expenseCategoryId: string }>(
  goalsNewestFirst: T[],
): Map<string, T> {
  const result = new Map<string, T>();
  for (const goal of goalsNewestFirst) {
    if (!result.has(goal.expenseCategoryId)) {
      result.set(goal.expenseCategoryId, goal);
    }
  }
  return result;
}

/** The user's active income source, if any — reused everywhere a cycle's income entry gets written. */
export function getActiveIncomeSource(db: Db, userId: string) {
  return db.incomeSource.findFirst({
    where: { userId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Creates or updates a cycle's income entry for a given income source and
 * amount — the shared "make this cycle's income reflect this amount" step,
 * reused by closing a cycle, the post-close pay-amount prompt, editing
 * income settings, and erasing all cycles. Relies on the
 * cycleId+incomeSourceId unique constraint, so two near-simultaneous calls
 * for the same cycle can never create duplicate entries. Accepts either the
 * top-level Prisma client or an interactive $transaction's tx client, since
 * some callers need this to participate in a larger atomic write.
 */
export function upsertCycleIncomeEntry(
  db: Db,
  cycleId: string,
  incomeSourceId: string,
  netAmount: Prisma.Decimal | string | number,
) {
  return db.cycleIncomeEntry.upsert({
    where: { cycleId_incomeSourceId: { cycleId, incomeSourceId } },
    create: { cycleId, incomeSourceId, netAmount },
    update: { netAmount },
  });
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

/**
 * Every closed cycle for the user, newest first — for the dedicated
 * History list (Profile -> History), as opposed to getRecentCycles'
 * smaller preview which also includes the still-open current cycle.
 * Filters status in the query itself rather than after fetching.
 */
export function getClosedCycles(userId: string, limit = 20) {
  return prisma.budgetCycle.findMany({
    where: { userId, status: "CLOSED" },
    orderBy: { periodStart: "desc" },
    take: limit,
    include: {
      incomeEntries: true,
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
 *
 * payDate anchors the new cycle's periodStart (and the old cycle's
 * periodEnd) — defaults to now, but the caller can pass an actual past pay
 * date (see ConfirmJustGotPaidSheet) for when the user opens the app a day
 * or two after actually getting paid, so days-remaining/daily-pace math
 * (lib/quincena-pace.ts) anchors to the real payday, not to whenever they
 * happened to tap the button.
 */
export async function closeCycleAndStartNext(
  userId: string,
  payDate: Date = new Date(),
): Promise<CloseCycleResult> {
  const currentCycle = await getOrCreateDraftCycle(userId);
  const closedCycleFinancials = await getCycleFinancials(currentCycle.id);

  const { closed: closedCycle, created: newCycle } = await prisma.$transaction(async (tx) => {
    const closed = await tx.budgetCycle.update({
      where: { id: currentCycle.id },
      data: { status: "CLOSED", periodEnd: payDate },
    });

    const created = await tx.budgetCycle.create({
      data: {
        userId,
        label: formatCycleLabel(payDate),
        periodStart: payDate,
        status: "ACTIVE",
      },
    });

    const incomeSource = await getActiveIncomeSource(tx, userId);
    if (incomeSource) {
      await upsertCycleIncomeEntry(tx, created.id, incomeSource.id, incomeSource.netQuincenaAmount);
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
