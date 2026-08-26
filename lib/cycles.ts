import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { getCycleFinancials, type CycleFinancials } from "@/lib/cycle-financials";
import type { BudgetCycle, Prisma, PrismaClient } from "@/app/generated/prisma/client";
import { addDays, FIRST_CYCLE_BACKDATE_FLOOR_DAYS, formatCycleLabel, nowInPanama, parsePayDate } from "@/lib/pay-date";
import { isUniqueConstraintViolation } from "@/lib/prisma-errors";
import { quincenaEnd } from "@/lib/quincena-pace";
import { formatFriendlyDate } from "@/lib/format";

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

/**
 * Recomputes one category's CycleBudgetGoal for one cycle from its
 * CycleRecurringExpense children — the "maintained aggregate" every
 * existing category-level reader (dashboard's fixed-budget card, History,
 * Manage Categories' hasBudgetGoal check) keeps reading unchanged. Called
 * after any create/update/delete/carry-forward
 * touching a category's recurring expenses in a given cycle. Deletes the
 * CycleBudgetGoal row entirely when the sum is zero (no recurring expenses
 * left) rather than leaving a $0 row behind — hasBudgetGoal checks row
 * existence, not amount, so a stale zero row would wrongly keep marking an
 * emptied-out category as "used."
 */
export async function recomputeCategoryBudgetGoal(db: Db, cycleId: string, categoryId: string): Promise<void> {
  const aggregate = await db.cycleRecurringExpense.aggregate({
    where: { cycleId, recurringExpense: { categoryId } },
    _sum: { targetAmount: true },
  });
  const total = aggregate._sum.targetAmount;

  if (!total || total.isZero()) {
    await db.cycleBudgetGoal.deleteMany({ where: { cycleId, expenseCategoryId: categoryId } });
    return;
  }

  await db.cycleBudgetGoal.upsert({
    where: { cycleId_expenseCategoryId: { cycleId, expenseCategoryId: categoryId } },
    create: { cycleId, expenseCategoryId: categoryId, targetAmount: total },
    update: { targetAmount: total },
  });
}

/**
 * Snapshots every one of a user's recurring (recurring: true) RecurringExpense
 * rows that should carry into a newly-created cycle (per
 * shouldCarryForwardToCycle, evaluated per-expense against its own
 * frequency/dueDay) into that cycle's CycleRecurringExpense rows, then
 * recomputes each affected category's CycleBudgetGoal aggregate. Reused by
 * both closeCycleAndStartNext (normal "just got paid" flow) and
 * eraseAllCyclesAction — unlike the old CycleBudgetGoal-copying loop this
 * replaces, there's no "previous cycle's goals" to read: a RecurringExpense
 * already IS the current definition, not a historical snapshot, so both
 * call sites can query it directly by userId.
 */
export async function carryForwardRecurringExpenses(
  db: Db,
  userId: string,
  newCycleId: string,
  newCyclePeriodStart: Date,
): Promise<void> {
  const recurringExpenses = await db.recurringExpense.findMany({ where: { userId, recurring: true } });
  const affectedCategoryIds = new Set<string>();

  for (const recurringExpense of recurringExpenses) {
    if (!shouldCarryForwardToCycle(recurringExpense, newCyclePeriodStart)) continue;

    // upsert, not create: makes this idempotent against a retry, so a
    // recurring expense can never end up with two snapshots for the same
    // new cycle.
    await db.cycleRecurringExpense.upsert({
      where: {
        cycleId_recurringExpenseId: { cycleId: newCycleId, recurringExpenseId: recurringExpense.id },
      },
      create: {
        cycleId: newCycleId,
        recurringExpenseId: recurringExpense.id,
        targetAmount: recurringExpense.amount,
      },
      update: {},
    });
    affectedCategoryIds.add(recurringExpense.categoryId);
  }

  for (const categoryId of affectedCategoryIds) {
    await recomputeCategoryBudgetGoal(db, newCycleId, categoryId);
  }
}

/**
 * Creates a RecurringExpense, its current-cycle CycleRecurringExpense
 * snapshot, and recomputes the category's aggregate -- the shared core of
 * "define a new recurring expense," used both by the explicit
 * "+ New recurring expense" flow (app/(app)/budget/recurring-actions.ts)
 * and by the transaction-level "This is a recurring expense" toggle's
 * no-existing-match branch (see linkOrCreateRecurringExpenseForTransaction
 * below).
 */
export async function createRecurringExpenseWithSnapshot(
  db: Db,
  params: {
    userId: string;
    categoryId: string;
    cycleId: string;
    name: string;
    amount: Prisma.Decimal | number | string;
    frequency?: "BIWEEKLY" | "MONTHLY";
    dueDay?: number | null;
  },
) {
  const recurringExpense = await db.recurringExpense.create({
    data: {
      userId: params.userId,
      categoryId: params.categoryId,
      name: params.name,
      amount: params.amount,
      frequency: params.frequency ?? "BIWEEKLY",
      dueDay: params.frequency === "MONTHLY" ? (params.dueDay ?? null) : null,
    },
  });

  await db.cycleRecurringExpense.create({
    data: { cycleId: params.cycleId, recurringExpenseId: recurringExpense.id, targetAmount: params.amount },
  });

  await recomputeCategoryBudgetGoal(db, params.cycleId, params.categoryId);

  return recurringExpense;
}

/**
 * The "This is a recurring expense" toggle's on-transition: an exact,
 * case-insensitive, trimmed name match within the transaction's own
 * category links to that existing RecurringExpense (creating this cycle's
 * snapshot first if one doesn't exist yet, using the recurring expense's
 * OWN amount as the target -- not this transaction's amount, which might
 * be a one-off variation); no match creates a brand-new one instead,
 * using this transaction's own name/category/amount and defaulting to
 * BIWEEKLY (matching createRecurringExpenseWithSnapshot's own default --
 * refining frequency/due-day is a later, explicit edit, not this
 * same-moment action's job). Deliberately an exact match, not the fuzzy
 * substring+10%-tolerance suggestion matcher used elsewhere -- this is a
 * same-moment user action, not a background suggestion, so a wrong
 * automatic link would be a real bug, not just an imperfect nudge.
 */
export async function linkOrCreateRecurringExpenseForTransaction(
  db: Db,
  params: {
    userId: string;
    transactionId: string;
    categoryId: string;
    cycleId: string;
    name: string;
    amount: Prisma.Decimal | number | string;
  },
): Promise<void> {
  const trimmedName = params.name.trim();
  const existing = await db.recurringExpense.findFirst({
    where: { categoryId: params.categoryId, name: { equals: trimmedName, mode: "insensitive" } },
  });

  let recurringExpenseId: string;
  if (existing) {
    recurringExpenseId = existing.id;
    const hasSnapshot = await db.cycleRecurringExpense.findUnique({
      where: { cycleId_recurringExpenseId: { cycleId: params.cycleId, recurringExpenseId } },
    });
    if (!hasSnapshot) {
      await db.cycleRecurringExpense.create({
        data: { cycleId: params.cycleId, recurringExpenseId, targetAmount: existing.amount },
      });
      await recomputeCategoryBudgetGoal(db, params.cycleId, params.categoryId);
    }
  } else {
    const created = await createRecurringExpenseWithSnapshot(db, {
      userId: params.userId,
      categoryId: params.categoryId,
      cycleId: params.cycleId,
      name: trimmedName,
      amount: params.amount,
    });
    recurringExpenseId = created.id;
  }

  await db.cycleTransaction.update({
    where: { id: params.transactionId },
    data: { recurringExpenseId },
  });
}

/**
 * The toggle's off-transition: unlinks one transaction without touching
 * the RecurringExpense definition itself -- other transactions, or past
 * cycles, may still reference it, so unlinking one payment must never
 * cascade into removing (or soft-deleting) the bill. Use the Recurring
 * Expenses tab's own Delete for that. Recomputing the aggregate here is a
 * defensive no-op in practice (targets live on CycleRecurringExpense, not
 * on which transactions happen to be linked) but costs nothing and keeps
 * this consistent with every other operation that touches a category's
 * recurring-expense state.
 */
export async function unlinkTransactionFromRecurringExpense(
  db: Db,
  params: { transactionId: string; cycleId: string; categoryId: string },
): Promise<void> {
  await db.cycleTransaction.update({
    where: { id: params.transactionId },
    data: { recurringExpenseId: null },
  });
  await recomputeCategoryBudgetGoal(db, params.cycleId, params.categoryId);
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

/** Uncached read of the user's current open (DRAFT or ACTIVE) cycle -- see getOrCreateDraftCycle's own cache() trap warning for when this, not that, is the right call. */
export function findOpenCycle(userId: string) {
  return prisma.budgetCycle.findFirst({
    where: { userId, status: { in: ["DRAFT", "ACTIVE"] } },
    orderBy: { periodStart: "desc" },
  });
}

/**
 * Returns the user's current open (DRAFT or ACTIVE) cycle, creating one if
 * none exists yet. Onboarding writes progressively into this same cycle's
 * related rows. A cycle is a paycheck period, not a calendar month — it
 * stays open until explicitly closed via closeCycleAndStartNext, however
 * often that happens (e.g. twice a month for semi-monthly pay).
 *
 * The find-then-create below is not atomic on its own — two concurrent
 * calls (two tabs, a retried request) could both see no open cycle and
 * both try to create one. What actually prevents the duplicate is a
 * partial unique index on (userId) WHERE status IN (DRAFT, ACTIVE) — see
 * prisma/migrations/20260815035814_race_condition_partial_unique_indexes
 * — so the loser's create() throws P2002 instead of succeeding; catching
 * that and re-reading is what makes this function itself race-safe.
 *
 * Wrapped in cache() so layout.tsx, dashboard/page.tsx, and
 * transactions/page.tsx — which each call this once per request for the
 * same userId — share a single Prisma round-trip instead of three. That's
 * a per-request dedupe only, not a concurrency fix — it doesn't help two
 * different concurrent requests, which is why the DB constraint above is
 * still required.
 *
 * TRAP: cache() memoizes for the lifetime of the current request, keyed on
 * userId — so calling this again *later in the same request*, after
 * something in that same request closed or created a cycle (e.g. right
 * after closeCycleAndStartNext), returns the now-stale cached value, not
 * the actual current draft cycle. No caller does this today; if one ever
 * needs "the draft cycle, freshly re-read, after a mutation earlier in
 * this same request," call findOpenCycle directly instead of this.
 */
export const getOrCreateDraftCycle = cache(async (userId: string): Promise<BudgetCycle> => {
  const existing = await findOpenCycle(userId);
  if (existing) return existing;

  const now = nowInPanama();
  try {
    return await prisma.budgetCycle.create({
      data: { userId, label: formatCycleLabel(now), periodStart: now },
    });
  } catch (error) {
    if (!isUniqueConstraintViolation(error)) throw error;
    // Lost the race to a concurrent call that also passed the check above
    // — the unique index guarantees exactly one winner; re-read it.
    const winner = await findOpenCycle(userId);
    if (winner) return winner;
    throw error;
  }
});

/** The user's most recently closed cycle, if any — for a "last paycheck" summary. */
export function getMostRecentClosedCycle(userId: string) {
  return prisma.budgetCycle.findFirst({
    where: { userId, status: "CLOSED" },
    orderBy: { periodEnd: "desc" },
  });
}

/**
 * Which cycle actually covers a given date — the most recently-started
 * cycle whose periodStart is on or before it. Cycle membership has always
 * been a fixed cycleId set at creation time, never computed from a date
 * range, so this is only needed when a transaction's date is edited and
 * needs to move to whichever cycle its new (or already-mismatched) date
 * really belongs to (see updateTransactionAction). Null only if the date
 * predates every cycle the user has ever had.
 *
 * Closing twice in the same day is explicitly supported (see
 * closeCycleAndStartNext), which can leave two cycles with the *same*
 * periodStart day — periodStart desc alone doesn't break that tie
 * deterministically. createdAt asc as the tiebreaker resolves it to
 * whichever of the two existed first (the one that was open for most of
 * that day), rather than an arbitrary/unstable pick.
 */
export function findCycleForDate(userId: string, date: Date) {
  return prisma.budgetCycle.findFirst({
    where: { userId, periodStart: { lte: date } },
    orderBy: [{ periodStart: "desc" }, { createdAt: "asc" }],
  });
}

/**
 * The cycle immediately before and after a given one, by periodStart —
 * needed for past-cycle pay-date editing, to know the valid range a new
 * periodStart can move within without overlapping a neighbor. No such
 * lookup existed before this; cycle order was only ever walked forward
 * (nextQuincenaStart) or resolved by date (findCycleForDate).
 */
export async function getAdjacentCycles(
  userId: string,
  cycle: Pick<BudgetCycle, "id" | "periodStart">,
): Promise<{ previous: BudgetCycle | null; next: BudgetCycle | null }> {
  const [previous, next] = await Promise.all([
    prisma.budgetCycle.findFirst({
      where: { userId, periodStart: { lt: cycle.periodStart }, id: { not: cycle.id } },
      orderBy: { periodStart: "desc" },
    }),
    prisma.budgetCycle.findFirst({
      where: { userId, periodStart: { gt: cycle.periodStart }, id: { not: cycle.id } },
      orderBy: { periodStart: "asc" },
    }),
  ]);
  return { previous, next };
}

export interface PayDateChangeAssessment {
  ok: true;
  /** False when the candidate date is identical to the cycle's current periodStart — a net-pay-only edit, nothing to reassign. */
  changed: boolean;
  movingCount: number;
  direction: "in" | "out" | null;
  otherCycleId: string | null;
  otherCycleLabel: string | null;
  /** The exact occurredAt range the commit path's updateMany must reuse verbatim — computed once here so preview and commit can never disagree. */
  moveRange: { gte: Date; lt: Date } | null;
}

export type PayDateChangeResult = PayDateChangeAssessment | { ok: false; error: string };

/**
 * What would happen if a cycle's periodStart moved to newPeriodStart —
 * shared by the pay-date preview action and the actual commit, so the
 * count a user is shown before confirming is guaranteed to match what
 * really gets reassigned. Moving periodStart only ever affects the
 * boundary with the PREVIOUS cycle (the boundary with the next cycle is
 * that next cycle's own periodStart, untouched by this edit) — earlier
 * pulls transactions in from the previous cycle, later pushes this
 * cycle's earliest transactions back to it. Rejects outright (no
 * cascading multi-cycle reassignment) if the candidate date would
 * overlap either neighbor.
 */
export async function assessPayDateChange(
  userId: string,
  cycle: Pick<BudgetCycle, "id" | "periodStart">,
  newPeriodStart: Date,
): Promise<PayDateChangeResult> {
  const { previous, next } = await getAdjacentCycles(userId, cycle);

  if (previous && newPeriodStart.getTime() <= previous.periodStart.getTime()) {
    return {
      ok: false,
      error: `Pay date must be after ${formatFriendlyDate(previous.periodStart)}${
        next ? ` and before ${formatFriendlyDate(next.periodStart)}` : ""
      }.`,
    };
  }
  if (next && newPeriodStart.getTime() >= next.periodStart.getTime()) {
    return {
      ok: false,
      error: `Pay date must be after ${
        previous ? formatFriendlyDate(previous.periodStart) : "the start of your history"
      } and before ${formatFriendlyDate(next.periodStart)}.`,
    };
  }

  const oldStart = cycle.periodStart;
  if (newPeriodStart.getTime() === oldStart.getTime()) {
    return {
      ok: true,
      changed: false,
      movingCount: 0,
      direction: null,
      otherCycleId: null,
      otherCycleLabel: null,
      moveRange: null,
    };
  }

  if (!previous) {
    // The account's very first cycle has no previous neighbor to bound it
    // below, so an accidental backdate (a fat-fingered year, say) would
    // otherwise go through unchecked. Generous on purpose -- a legitimate
    // correction is realistically at most a few weeks off, never years --
    // and only applies to an actual change, never to re-saving whatever
    // value is already stored (see the unchanged-value return above).
    const earliestAllowed = addDays(nowInPanama(), -FIRST_CYCLE_BACKDATE_FLOOR_DAYS);
    if (newPeriodStart.getTime() < earliestAllowed.getTime()) {
      return {
        ok: false,
        error: `Pay date can't be more than ${FIRST_CYCLE_BACKDATE_FLOOR_DAYS} days in the past for your first quincena.`,
      };
    }
    // Nothing before this cycle to pull from or push into.
    return {
      ok: true,
      changed: true,
      movingCount: 0,
      direction: null,
      otherCycleId: null,
      otherCycleLabel: null,
      moveRange: null,
    };
  }

  const direction: "in" | "out" = newPeriodStart.getTime() < oldStart.getTime() ? "in" : "out";
  const moveRange =
    direction === "in" ? { gte: newPeriodStart, lt: oldStart } : { gte: oldStart, lt: newPeriodStart };
  const movingCount = await prisma.cycleTransaction.count({
    where: { cycleId: direction === "in" ? previous.id : cycle.id, occurredAt: moveRange },
  });

  return {
    ok: true,
    changed: true,
    movingCount,
    direction,
    otherCycleId: previous.id,
    otherCycleLabel: previous.label,
    moveRange,
  };
}

/**
 * "Aug 1–15, 2026" (same month) or "Jul 29 – Aug 15, 2026" (spanning a
 * month boundary) — for confirmation-message copy naming a cycle's actual
 * date range. Uses the real stored periodEnd for a closed cycle (set at
 * close time to whatever the next cycle's periodStart was) rather than
 * quincenaEnd's calendar-idealized value, which can diverge once pay
 * dates have been edited; falls back to quincenaEnd for an open cycle,
 * which has no periodEnd yet.
 *
 * `includeYear: false` (e.g. a page header naming the current, obviously-
 * this-year cycle — "Aug 11–25" rather than "Aug 11–25, 2026") drops the
 * year from every branch; defaults to true so existing callers (older
 * confirmation-copy contexts, where the year is genuinely useful context)
 * are unaffected.
 */
export function formatCycleRangeText(
  cycle: Pick<BudgetCycle, "periodStart" | "periodEnd">,
  options: { includeYear?: boolean } = {},
): string {
  const { includeYear = true } = options;
  const end = cycle.periodEnd ?? quincenaEnd(cycle.periodStart);
  const dateOpts: Intl.DateTimeFormatOptions = includeYear
    ? { month: "short", day: "numeric", year: "numeric" }
    : { month: "short", day: "numeric" };
  // A same-day close (closing twice in one day is explicitly supported —
  // see closeCycleAndStartNext) makes periodStart and periodEnd the same
  // calendar day; "Aug 15–15, 2026" would read as a typo, not a range.
  if (cycle.periodStart.toDateString() === end.toDateString()) {
    return includeYear ? formatFriendlyDate(cycle.periodStart) : cycle.periodStart.toLocaleDateString("en-US", dateOpts);
  }
  const sameMonth =
    cycle.periodStart.getMonth() === end.getMonth() &&
    cycle.periodStart.getFullYear() === end.getFullYear();
  const startText = cycle.periodStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (sameMonth) {
    return includeYear ? `${startText}–${end.getDate()}, ${end.getFullYear()}` : `${startText}–${end.getDate()}`;
  }
  return includeYear
    ? `${startText} – ${formatFriendlyDate(end)}`
    : `${startText} – ${end.toLocaleDateString("en-US", dateOpts)}`;
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
  payDate: Date = nowInPanama(),
): Promise<CloseCycleResult> {
  const currentCycle = await getOrCreateDraftCycle(userId);
  const closedCycleFinancials = await getCycleFinancials(currentCycle.id);

  let closedCycle: BudgetCycle;
  let newCycle: BudgetCycle;
  try {
    const result = await prisma.$transaction(async (tx) => {
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
      // only into the one quincena matching its dueDay. SAVINGS categories
      // still work exactly this way today (the Goals tab has no concept of
      // individual recurring expenses). EXPENSE categories moved to the
      // RecurringExpense model -- see carryForwardRecurringExpenses.
      const previousSavingsGoals = await tx.cycleBudgetGoal.findMany({
        where: { cycleId: closed.id, expenseCategory: { recurring: true, type: "SAVINGS" } },
        include: { expenseCategory: true },
      });

      for (const goal of previousSavingsGoals) {
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

      await carryForwardRecurringExpenses(tx, userId, created.id, created.periodStart);

      return { closed, created };
    });
    closedCycle = result.closed;
    newCycle = result.created;
  } catch (error) {
    if (!isUniqueConstraintViolation(error)) throw error;
    // Lost the race to a concurrent "I just got paid" on the same draft
    // cycle (two tabs, near-simultaneous taps) — the partial unique index
    // on (userId) WHERE status IN (DRAFT, ACTIVE) means only one of the two
    // budgetCycle.create calls above can win, and the loser's whole
    // transaction rolls back (including its own close of currentCycle),
    // never leaving partial state. The cycle IS closed regardless — just by
    // the other caller — so re-read what actually happened instead of
    // surfacing this as a failure.
    const [reReadClosed, reReadNew] = await Promise.all([
      prisma.budgetCycle.findUniqueOrThrow({ where: { id: currentCycle.id } }),
      findOpenCycle(userId),
    ]);
    if (!reReadNew) throw error;
    closedCycle = reReadClosed;
    newCycle = reReadNew;
  }

  return { closedCycle, newCycle, closedCycleFinancials };
}
