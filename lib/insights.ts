import type { CycleFinancials } from "@/lib/cycle-financials";
import { formatCurrency, formatFriendlyDate, formatShortDate } from "@/lib/format";
import type { LocaleValue } from "@/lib/i18n/locale";
import { addDays, nearestMonthlyDueDate, nowInPanama } from "@/lib/pay-date";
import { calendarDaysBetween, cycleEnd, type BudgetFrequency } from "@/lib/quincena-pace";
import { summarizeRecurringExpenses, type CategoryWithRecurringExpenses } from "@/lib/recurring-expenses";
import type { GoalWithProgress } from "@/lib/goals";
import { computeGoalProjection } from "@/lib/goal-projection";
import type { Dictionary, PeriodVocab } from "@/lib/i18n/dictionary";
import { promptHref, type InsightPrompt } from "@/lib/insight-prompts";

type InsightsDictionary = Dictionary["insights"];

/* ------------------------------------------------------------------ *
 * Settings. Every threshold and priority lives here, by name.
 * ------------------------------------------------------------------ */

/**
 * Higher wins one of the card's MAX_INSIGHTS slots. Money-risk first
 * (red), then things to act on, then informational, then positives.
 */
export const PRIORITY = {
  OVER_BUDGET: 94,
  PACE_WARNING: 92,
  MISSED_CHARGE: 89,
  DUPLICATE_CHARGE: 88,
  UNCATEGORIZED: 86,
  PRICE_CHANGE: 84,
  LARGE_PURCHASE: 82,
  CATEGORY_ANOMALY: 80,
  NEW_RECURRING: 76,
  GOAL_CONTRIBUTION: 72,
  UPCOMING_CHARGES: 65,
  SAVINGS_GOAL: 60,
  LEFTOVER: 58,
  STILL_TO_CHARGE: 55,
  // Positives (green dot) -- below every money-risk and to-do insight.
  GOAL_MILESTONE: 50,
  CLOSED_UNDER: 49,
  GOAL_CONTRIBUTION_MADE: 47,
  SPENT_LESS: 46,
  AHEAD_OF_PACE: 45,
  STREAK: 44,
  ON_TRACK: 40,
} as const;

/** How many insights the card shows. */
export const MAX_INSIGHTS = 2;

/** Heads-up window: charges due today through this many days ahead. */
export const UPCOMING_WITHIN_DAYS = 3;
/** A charge date that passed 1 to this many days ago with nothing linked is "expected but missing". */
export const MISSED_WITHIN_DAYS = 3;
/** "Still to be charged" stays quiet until this fraction of the cycle has passed -- on day 1 everything is still to be charged. */
export const STILL_TO_CHARGE_MIN_PERCENT_ELAPSED = 0.5;
/** "Running out of cash" needs this many days of spending before a daily rate means anything. */
export const PACE_MIN_ELAPSED_DAYS = 3;

/** A category has to be this fraction over its prorated usual spend to count as "up". */
export const ANOMALY_THRESHOLD_FRACTION = 0.2;
/** How many closed cycles' average to compare against, at most. */
export const ANOMALY_WINDOW_SIZE = 4;
/** Closed cycles needed before the category rule runs at all. */
export const ANOMALY_MIN_HISTORY = 1;
/** Dollar floor on a category swing, so $4 -> $5 can't beat a real $200 overage. Doubled for MONTHLY cycles, which carry bigger swings. */
export function anomalyMinDollarDelta(budgetFrequency: BudgetFrequency): number {
  return budgetFrequency === "MONTHLY" ? 30 : 15;
}
/** Categories usually smaller than this per cycle are never flagged. Doubled for MONTHLY. */
export function anomalyMinAverage(budgetFrequency: BudgetFrequency): number {
  return budgetFrequency === "MONTHLY" ? 50 : 25;
}

/** Goal milestones (percent of target) worth a one-time mention when crossed this cycle. */
export const GOAL_MILESTONES = [50, 75, 90] as const;

/** "Goal contribution behind" stays quiet until this fraction of the cycle has passed. */
export const GOAL_CONTRIBUTION_MIN_PERCENT_ELAPSED = 0.6;
/** ...and fires when less than this fraction of the planned contribution is logged. */
export const GOAL_CONTRIBUTION_THRESHOLD_FRACTION = 0.5;

/** Two Gmail imports from the same merchant for the same amount within this many days may be a double charge. */
export const DUPLICATE_CHARGE_WITHIN_DAYS = 3;

/** A recurring charge differing from its saved amount by more than this fraction is a payment issue, not a price change. */
export const PRICE_CHANGE_MAX_FRACTION = 0.5;

/** A purchase is "unusually large" at this multiple of the category's usual purchase... */
export const LARGE_PURCHASE_MULTIPLE = 3;
/** ...and at least this many dollars above it... */
export const LARGE_PURCHASE_MIN_DOLLARS = 50;
/** ...with at least this many past purchases in the category to know what's usual. */
export const LARGE_PURCHASE_MIN_HISTORY = 3;

/** Gaps (in days) between two same-merchant, same-amount charges that suggest a recurring expense: about every quincena or month. */
export const NEW_RECURRING_GAPS: readonly [number, number][] = [
  [13, 17],
  [28, 33],
];
/** Same-merchant amounts within this fraction count as "the same amount". */
export const NEW_RECURRING_AMOUNT_FRACTION = 0.05;

/** "Spent less than usual" and "ahead of pace" wait until this fraction of the cycle has passed -- early on, everything looks under pace. */
export const POSITIVE_MIN_PERCENT_ELAPSED = 0.5;
/** "Ahead of pace": at least this fraction under the expected day-to-day spending so far... */
export const AHEAD_OF_PACE_MIN_FRACTION = 0.25;
/** ...and at least this many dollars. */
export const AHEAD_OF_PACE_MIN_DOLLARS = 25;
/** "You finished with $X left" shows during the first this-many days of the next cycle. */
export const CLOSED_UNDER_FIRST_DAYS = 3;
/** Cycles in a row under usual spending before it's a streak worth mentioning. */
export const STREAK_MIN_CYCLES = 3;

/** "Move what's left to a goal?" shows in the last this-many days of a cycle (or once it's past its end). */
export const LEFTOVER_LAST_DAYS = 2;
/** ...when at least this much is left. */
export const LEFTOVER_MIN_DOLLARS = 20;

/* ------------------------------------------------------------------ */

/** critical = red (money risk), recurring = gold (recurring charges), uncategorized = orange, positive = green. Absent = neutral. */
export type InsightSeverity = "critical" | "recurring" | "uncategorized" | "positive";

export interface Insight {
  /** Stable identity, e.g. "missed:<recurringId>:2026-10-16" -- what a dismissal is stored under. */
  key: string;
  /** Snapshot of the data behind it. A dismissal only hides the insight while this still matches. */
  fingerprint: string;
  text: string;
  /** Where tapping goes; absent renders plain text. */
  href?: string;
  /**
   * The dot: "critical" (red) for money risk, "recurring" (gold) for
   * recurring charges, absent for a neutral dot.
   */
  severity?: InsightSeverity;
}

/** A stored InsightMemory row, as the rules need it. */
export interface InsightMemoryRecord {
  key: string;
  fingerprint: string;
  until: Date | null;
  /** Which button was pressed -- "one-time" purchases are left out of category averages. */
  response?: string;
}

export interface Candidate extends Insight {
  priority: number;
  /** Which rule produced it -- at most one per rule reaches the card. */
  rule: string;
  /** Has a follow-up prompt -- wins ties. */
  actionable?: boolean;
}

/** A candidate whose tap opens `path` with a follow-up prompt. */
function withPrompt(path: string, prompt: InsightPrompt, query?: Record<string, string>) {
  return { href: promptHref(path, prompt, query), actionable: true };
}

export interface InsightExtras {
  cycleId: string;
  /** periodEnd is only set once a cycle closes; an open cycle's end is derived from periodStart. */
  cycle: { periodStart: Date; periodEnd: Date | null };
  /** This cycle's recurring expenses, e.g. from getRecurringExpensesForCycle. */
  recurringExpenseCategories: CategoryWithRecurringExpenses[];
  goals: GoalWithProgress[];
  budgetFrequency: BudgetFrequency;
  vocab: PeriodVocab;
  locale?: LocaleValue;
  /** Defaults to nowInPanama() -- overridable for tests. */
  now?: Date;
  t: InsightsDictionary;
  /** Stored dismissals; matching insights are left out. */
  memory?: InsightMemoryRecord[];
  /** How many of this cycle's transactions still need a category. */
  needsCategoryCount?: number;
  /** Every recurring expense the user has, by name -- so a known one is never "suspected" as new. */
  recurringExpenseNames?: string[];
  /** The most recent closed cycle's id (previousClosedFinancials[0]) -- its leftover can go to a goal. */
  lastClosedCycleId?: string;
}

/**
 * Rule-based insights from real cycle history -- no LLM call. Each rule
 * returns its candidates, most relevant first. Dismissed ones are dropped,
 * each rule keeps its best remaining one (so dismissing one duplicate pair
 * surfaces the next), and the top MAX_INSIGHTS by priority win -- ties go
 * to an insight with a follow-up prompt. `previousClosedFinancials` must be
 * newest-first (as getRecentCycles returns).
 */
export function generateInsights(
  current: CycleFinancials,
  previousClosedFinancials: CycleFinancials[],
  extras: InsightExtras,
): Insight[] {
  const now = extras.now ?? nowInPanama();
  const oneTimeIds = new Set(
    (extras.memory ?? []).filter((m) => m.response === "one-time").map((m) => m.key.replace(/^large:/, "")),
  );
  const ctx: RuleContext = {
    current: withoutOneTime(current, oneTimeIds),
    rawCurrent: current,
    previous: previousClosedFinancials.map((f) => withoutOneTime(f, oneTimeIds)),
    extras,
    now,
    t: extras.t,
    locale: extras.locale ?? "en",
    phase: cyclePhase(extras.cycle, extras.budgetFrequency, now),
  };

  const candidates = [
    ...uncategorizedCandidates(ctx),
    ...priceChangeCandidates(ctx),
    ...largePurchaseCandidates(ctx),
    ...newRecurringCandidates(ctx),
    ...leftoverCandidates(ctx),
    ...upcomingChargesCandidates(ctx),
    ...missedChargeCandidates(ctx),
    ...stillToChargeCandidates(ctx),
    ...duplicateChargeCandidates(ctx),
    ...categoryAnomalyCandidates(ctx),
    ...paceCandidates(ctx),
    ...goalContributionCandidates(ctx),
    ...savingsGoalCandidates(ctx),
    ...goalMilestoneCandidates(ctx),
    ...closedUnderCandidates(ctx),
    ...goalContributionMadeCandidates(ctx),
    ...spentLessCandidates(ctx),
    ...aheadOfPaceCandidates(ctx),
    ...streakCandidates(ctx),
  ];

  return selectInsights(candidates, extras.memory ?? [], now);
}

/**
 * Drops dismissed candidates, keeps each rule's best remaining one, and
 * returns the top MAX_INSIGHTS by priority -- a tie goes to the one with a
 * follow-up prompt. Exported for tests.
 */
export function selectInsights(candidates: Candidate[], memory: InsightMemoryRecord[], now: Date): Insight[] {
  const isDismissed = (c: Candidate) =>
    memory.some(
      (m) =>
        m.key === c.key &&
        (m.fingerprint === "*" || m.fingerprint === c.fingerprint) &&
        (m.until === null || m.until > now),
    );

  const seenRules = new Set<string>();
  return candidates
    .filter((c) => !isDismissed(c))
    .filter((c) => !seenRules.has(c.rule) && seenRules.add(c.rule))
    .sort((a, b) => b.priority - a.priority || Number(!!b.actionable) - Number(!!a.actionable))
    .slice(0, MAX_INSIGHTS)
    .map(({ key, fingerprint, text, href, severity }) => ({
      key,
      fingerprint,
      text,
      ...(href ? { href } : {}),
      ...(severity ? { severity } : {}),
    }));
}

interface CyclePhase {
  totalDays: number;
  elapsedDays: number;
  daysRemaining: number;
  /** 0 (just started) to 1 (last day). */
  percentElapsed: number;
}

interface RuleContext {
  /** This cycle, with purchases marked "one-time" left out of category totals. */
  current: CycleFinancials;
  /** This cycle exactly as recorded. */
  rawCurrent: CycleFinancials;
  previous: CycleFinancials[];
  extras: InsightExtras;
  now: Date;
  t: InsightsDictionary;
  locale: LocaleValue;
  phase: CyclePhase;
}

/** Category totals without purchases the user marked "one-time", so one big purchase can't skew what "usual" means. */
function withoutOneTime(f: CycleFinancials, oneTimeIds: Set<string>): CycleFinancials {
  const excluded = f.transactions.filter((tx) => oneTimeIds.has(tx.id) && tx.type === "EXPENSE" && tx.expenseCategoryId);
  if (excluded.length === 0) return f;
  const categoryTotals = f.categoryTotals
    .map((c) => ({
      ...c,
      amount: c.amount - excluded.filter((tx) => tx.expenseCategoryId === c.categoryId).reduce((s, tx) => s + tx.amount, 0),
    }))
    .filter((c) => c.amount > 0)
    .sort((a, b) => b.amount - a.amount);
  return { ...f, categoryTotals, topCategories: categoryTotals.slice(0, 6) };
}

function cyclePhase(cycle: { periodStart: Date; periodEnd: Date | null }, budgetFrequency: BudgetFrequency, now: Date): CyclePhase {
  const resolvedCycleEnd = cycle.periodEnd ?? cycleEnd(cycle.periodStart, budgetFrequency);
  const totalDays = calendarDaysBetween(cycle.periodStart, resolvedCycleEnd) + 1;
  const elapsedDays = Math.min(Math.max(calendarDaysBetween(cycle.periodStart, now) + 1, 1), totalDays);
  const daysRemaining = Math.max(totalDays - elapsedDays, 0);
  return { totalDays, elapsedDays, daysRemaining, percentElapsed: elapsedDays / totalDays };
}

/** Every recurring expense charged this cycle with nothing linked yet, with its nearest charge date. */
function unchargedDatedExpenses(ctx: RuleContext) {
  return ctx.extras.recurringExpenseCategories.flatMap((category) =>
    category.expenses
      .filter((e) => e.chargedThisCycle && e.dueDay !== null && e.status === "not-started")
      .map((e) => {
        const dueDate = nearestMonthlyDueDate(ctx.now, e.dueDay!);
        return { expense: e, dueDate, daysUntil: calendarDaysBetween(ctx.now, dueDate) };
      }),
  );
}

/**
 * Heads-up, not a payment reminder: recurring charges happen on their own.
 * One charge names it; several in the window are combined.
 */
function upcomingChargesCandidates(ctx: RuleContext): Candidate[] {
  const { t } = ctx;
  const upcoming = unchargedDatedExpenses(ctx)
    .filter((u) => u.daysUntil >= 0 && u.daysUntil <= UPCOMING_WITHIN_DAYS)
    .sort((a, b) => a.daysUntil - b.daysUntil);
  if (upcoming.length === 0) return [];

  const text =
    upcoming.length === 1
      ? t.chargeComingUp(
          upcoming[0].expense.name,
          formatCurrency(upcoming[0].expense.targetAmount),
          upcoming[0].daysUntil,
        )
      : t.chargesComingUp(
          upcoming.length,
          UPCOMING_WITHIN_DAYS,
          formatCurrency(upcoming.reduce((sum, u) => sum + u.expense.targetAmount, 0)),
        );
  return [
    {
      rule: "upcoming",
      key: `upcoming:${ctx.extras.cycleId}`,
      fingerprint: upcoming.map((u) => `${u.expense.id}@${u.dueDate.toISOString().slice(0, 10)}`).join(","),
      text,
      priority: PRIORITY.UPCOMING_CHARGES,
      href: "/plan",
      severity: "recurring",
    },
  ];
}

/** A charge date passed 1-3 days ago and nothing has shown up for it. Most overdue first. */
function missedChargeCandidates(ctx: RuleContext): Candidate[] {
  return unchargedDatedExpenses(ctx)
    .filter((u) => u.daysUntil < 0 && u.daysUntil >= -MISSED_WITHIN_DAYS)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .map(({ expense, dueDate }) => {
      const date = dueDate.toISOString().slice(0, 10);
      return {
        rule: "missed",
        key: `missed:${expense.id}:${date}`,
        fingerprint: String(expense.targetAmount),
        text: ctx.t.chargeMissing(expense.name, formatCurrency(expense.targetAmount), formatShortDate(dueDate, ctx.locale)),
        priority: PRIORITY.MISSED_CHARGE,
        severity: "recurring" as const,
        ...withPrompt("/plan", { kind: "missed", key: `missed:${expense.id}:${date}`, target: expense.id }),
      };
    });
}

/**
 * How many recurring expenses are still to be charged this cycle. Safe to
 * spend already reserves this money, so it's informational and only shows
 * past the halfway point.
 */
function stillToChargeCandidates(ctx: RuleContext): Candidate[] {
  if (ctx.phase.percentElapsed < STILL_TO_CHARGE_MIN_PERCENT_ELAPSED) return [];
  const pending = ctx.extras.recurringExpenseCategories
    .flatMap((c) => c.expenses)
    .filter((e) => e.chargedThisCycle && (e.status === "not-started" || e.status === "partial"));
  if (pending.length === 0) return [];
  const remaining = pending.reduce((sum, e) => sum + Math.max(e.targetAmount - e.actual, 0), 0);
  return [
    {
      rule: "still-to-charge",
      key: `still-to-charge:${ctx.extras.cycleId}`,
      fingerprint: `${pending.length}:${remaining.toFixed(2)}`,
      text: ctx.t.stillToCharge(pending.length, formatCurrency(remaining)),
      priority: PRIORITY.STILL_TO_CHARGE,
      href: "/plan",
      severity: "recurring",
    },
  ];
}

/**
 * Two Gmail-imported expenses from the same merchant (ignoring case), for
 * the same amount, within DUPLICATE_CHARGE_WITHIN_DAYS. Manual entries are
 * ignored -- typing the same coffee twice is normal. One candidate per
 * pair, so dismissing one surfaces the next.
 */
function duplicateChargeCandidates(ctx: RuleContext): Candidate[] {
  const { t, locale } = ctx;
  const gmail = ctx.current.transactions.filter((tx) => tx.importSource === "GMAIL" && tx.type === "EXPENSE");
  const out: Candidate[] = [];
  for (let i = 0; i < gmail.length; i++) {
    for (let j = i + 1; j < gmail.length; j++) {
      const a = gmail[i];
      const b = gmail[j];
      if (a.amount !== b.amount) continue;
      const nameA = a.name.trim().toLowerCase();
      if (!nameA || nameA !== b.name.trim().toLowerCase()) continue;
      const gap = Math.abs(calendarDaysBetween(a.occurredAt, b.occurredAt));
      if (gap > DUPLICATE_CHARGE_WITHIN_DAYS) continue;

      const [earlier, later] = a.occurredAt <= b.occurredAt ? [a, b] : [b, a];
      const amount = formatCurrency(a.amount);
      const text =
        gap === 0
          ? t.duplicateSameDay(a.name, amount, formatShortDate(later.occurredAt, locale))
          : t.duplicateTwoDays(a.name, amount, formatShortDate(earlier.occurredAt, locale), formatShortDate(later.occurredAt, locale));
      const ids = [earlier.id, later.id].sort() as [string, string];
      const key = `duplicate:${ids[0]}:${ids[1]}`;
      out.push({
        rule: "duplicate",
        key,
        fingerprint: "",
        text,
        priority: PRIORITY.DUPLICATE_CHARGE,
        href: promptHref("/transactions", { kind: "duplicate", key, ids }),
        actionable: true,
      });
    }
  }
  return out;
}

/**
 * Categories spending more than usual, compared against the average of up
 * to ANOMALY_WINDOW_SIZE closed cycles prorated to how far into this cycle
 * we are. Must clear a minimum usual size, a dollar floor and a relative
 * threshold. Biggest relative swing first. Matches by categoryId, so a
 * rename never breaks it.
 */
function categoryAnomalyCandidates(ctx: RuleContext): Candidate[] {
  const { current, previous, phase, extras, t } = ctx;
  if (previous.length < ANOMALY_MIN_HISTORY) return [];
  const window = previous.slice(0, ANOMALY_WINDOW_SIZE);
  const minAverage = anomalyMinAverage(extras.budgetFrequency);
  const minDollarDelta = anomalyMinDollarDelta(extras.budgetFrequency);

  const ups: (Candidate & { relativeDelta: number })[] = [];
  for (const category of current.categoryTotals) {
    const sum = window.reduce(
      (total, cycle) => total + (cycle.categoryTotals.find((c) => c.categoryId === category.categoryId)?.amount ?? 0),
      0,
    );
    const average = sum / window.length;
    if (average < minAverage) continue;
    // Prorate the full-cycle average to "what we'd expect by now", so a
    // half-finished cycle isn't compared against a whole one.
    const expected = average * phase.percentElapsed;
    const dollarDelta = category.amount - expected;
    if (dollarDelta < minDollarDelta) continue;
    const relativeDelta = dollarDelta / expected;
    if (relativeDelta < ANOMALY_THRESHOLD_FRACTION) continue;

    const amount = formatCurrency(dollarDelta);
    ups.push({
      rule: "category-up",
      // Dismissing hides it for the rest of this cycle, whatever the amount does.
      key: `category-up:${extras.cycleId}:${category.categoryId}`,
      fingerprint: "",
      text: window.length === 1 ? t.categoryDelta(category.categoryName, amount) : t.categoryAnomaly(category.categoryName, amount),
      priority: PRIORITY.CATEGORY_ANOMALY,
      ...withPrompt(
        "/transactions",
        { kind: "category-up", key: `category-up:${extras.cycleId}:${category.categoryId}`, target: category.categoryId },
        { category: category.categoryId },
      ),
      relativeDelta,
    });
  }
  return ups.sort((a, b) => b.relativeDelta - a.relativeDelta);
}

/**
 * Pace against Safe to spend (money left minus unpaid recurring charges
 * this cycle). Over budget when that's negative. Otherwise, after
 * PACE_MIN_ELAPSED_DAYS, projects the day-to-day spending rate -- leaving
 * out charges linked to recurring expenses, so one rent payment can't
 * inflate it -- and warns when it would run out before payday. Else a
 * plain reassurance with no dollar figure (Home already shows the number).
 */
function paceCandidates(ctx: RuleContext): Candidate[] {
  const { current, phase, now, t, locale, extras } = ctx;
  const safeToSpend = current.amountLeft - summarizeRecurringExpenses(extras.recurringExpenseCategories).pendingAmount;

  if (safeToSpend < 0) {
    return [
      {
        rule: "pace",
        key: `over-budget:${extras.cycleId}`,
        fingerprint: Math.ceil(-safeToSpend).toString(),
        text: t.overBudget(formatCurrency(-safeToSpend), phase.daysRemaining),
        priority: PRIORITY.OVER_BUDGET,
        href: "/transactions/breakdown",
        severity: "critical",
      },
    ];
  }

  const dayToDaySpent = current.transactions
    .filter((tx) => tx.type === "EXPENSE" && tx.recurringExpenseId === null)
    .reduce((sum, tx) => sum + tx.amount, 0);
  const dailyRate = dayToDaySpent / phase.elapsedDays;
  if (phase.elapsedDays >= PACE_MIN_ELAPSED_DAYS && dailyRate > 0) {
    const daysUntilExhausted = Math.floor(safeToSpend / dailyRate);
    if (daysUntilExhausted < phase.daysRemaining) {
      const runOutDate = addDays(now, daysUntilExhausted);
      return [
        {
          rule: "pace",
          key: `run-out:${extras.cycleId}`,
          fingerprint: runOutDate.toISOString().slice(0, 10),
          text: t.runOutOfCash(formatFriendlyDate(runOutDate, locale), phase.daysRemaining - daysUntilExhausted),
          priority: PRIORITY.PACE_WARNING,
          href: "/transactions/breakdown",
          severity: "critical",
        },
      ];
    }
  }

  return [
    {
      rule: "pace",
      key: `on-track:${extras.cycleId}`,
      fingerprint: "",
      text: t.onTrackPace,
      priority: PRIORITY.ON_TRACK,
    },
  ];
}

/** What each goal received this cycle (SAVINGS transactions in its category). */
function contributedThisCycle(current: CycleFinancials, goalCategoryId: string): number {
  return current.transactions
    .filter((tx) => tx.type === "SAVINGS" && tx.expenseCategoryId === goalCategoryId)
    .reduce((sum, tx) => sum + tx.amount, 0);
}

/**
 * Close to a savings goal: within one cycle's planned contribution of the
 * target -- so it ends when the goal is done instead of firing forever.
 * Milestones crossed on the way have their own positive insight.
 */
function savingsGoalCandidates(ctx: RuleContext): Candidate[] {
  const { extras, now, t } = ctx;
  const out: (Candidate & { percentage: number })[] = [];
  for (const goal of extras.goals) {
    if (goal.lifetimeTargetAmount <= 0) continue;
    const projection = computeGoalProjection({
      savedSoFar: goal.savedSoFar,
      lifetimeTargetAmount: goal.lifetimeTargetAmount,
      currentCycleRecurringAmount: goal.currentCycleRecurringAmount,
      now,
      frequency: extras.budgetFrequency,
    });
    if (projection.isComplete) continue;

    const planned = goal.currentCycleRecurringAmount ?? 0;
    if (!(planned > 0 && projection.remaining <= planned)) continue;

    out.push({
      rule: "goal-close",
      key: `goal-close:${goal.categoryId}`,
      fingerprint: projection.remaining.toFixed(2),
      text: t.savingsGoalClose(formatCurrency(projection.remaining), goal.name),
      priority: PRIORITY.SAVINGS_GOAL,
      href: "/plan",
      percentage: projection.percentage,
    });
  }
  return out.sort((a, b) => b.percentage - a.percentage);
}

/**
 * A goal with a planned per-cycle contribution that's less than half met
 * once GOAL_CONTRIBUTION_MIN_PERCENT_ELAPSED of the cycle has passed.
 * Biggest shortfall first.
 */
function goalContributionCandidates(ctx: RuleContext): Candidate[] {
  const { extras, current, phase, t } = ctx;
  if (phase.percentElapsed < GOAL_CONTRIBUTION_MIN_PERCENT_ELAPSED) return [];
  const out: (Candidate & { shortfall: number })[] = [];
  for (const goal of extras.goals) {
    const planned = goal.currentCycleRecurringAmount;
    if (!planned || planned <= 0) continue;
    const actual = contributedThisCycle(current, goal.categoryId);
    if (actual >= planned * GOAL_CONTRIBUTION_THRESHOLD_FRACTION) continue;
    out.push({
      rule: "goal-behind",
      key: `goal-behind:${extras.cycleId}:${goal.categoryId}`,
      fingerprint: actual.toFixed(2),
      text: t.goalContributionBehind(extras.vocab, formatCurrency(planned), formatCurrency(actual), goal.name, phase.daysRemaining),
      priority: PRIORITY.GOAL_CONTRIBUTION,
      href: "/plan",
      shortfall: planned - actual,
    });
  }
  return out.sort((a, b) => b.shortfall - a.shortfall);
}

/** "2 transactions need a category" -- tapping opens the Finish these transactions sheet on Home. */
function uncategorizedCandidates(ctx: RuleContext): Candidate[] {
  const count = ctx.extras.needsCategoryCount ?? 0;
  if (count === 0) return [];
  const key = `uncategorized:${ctx.extras.cycleId}`;
  return [
    {
      rule: "uncategorized",
      key,
      fingerprint: String(count),
      text: ctx.t.needCategory(count),
      priority: PRIORITY.UNCATEGORIZED,
      severity: "uncategorized",
      ...withPrompt("/dashboard", { kind: "uncategorized", key }),
    },
  ];
}

/**
 * A recurring expense charged exactly once this cycle, for a different
 * amount than saved -- a price change ("Spotify went from $0.99 to $1.19").
 * A big gap is more likely a partial or wrong link, so it's ignored.
 */
function priceChangeCandidates(ctx: RuleContext): Candidate[] {
  const out: Candidate[] = [];
  for (const expense of ctx.extras.recurringExpenseCategories.flatMap((c) => c.expenses)) {
    if (!expense.chargedThisCycle || expense.targetAmount <= 0) continue;
    const charges = ctx.rawCurrent.transactions.filter((tx) => tx.recurringExpenseId === expense.id && tx.type === "EXPENSE");
    if (charges.length !== 1) continue;
    const charged = charges[0].amount;
    const diff = Math.abs(charged - expense.targetAmount);
    if (diff < 0.01 || diff > expense.targetAmount * PRICE_CHANGE_MAX_FRACTION) continue;
    const key = `price-change:${expense.id}:${charged.toFixed(2)}`;
    out.push({
      rule: "price-change",
      key,
      fingerprint: expense.targetAmount.toFixed(2),
      text: ctx.t.priceChanged(expense.name, formatCurrency(expense.targetAmount), formatCurrency(charged)),
      priority: PRIORITY.PRICE_CHANGE,
      severity: "recurring",
      ...withPrompt("/plan", { kind: "price-change", key, target: expense.id }),
    });
  }
  return out;
}

/**
 * One purchase far above what the user usually spends per purchase in its
 * category (LARGE_PURCHASE_MULTIPLE times and LARGE_PURCHASE_MIN_DOLLARS
 * over), judged against past cycles. Recurring charges are skipped.
 */
function largePurchaseCandidates(ctx: RuleContext): Candidate[] {
  const past = ctx.previous.flatMap((f) => f.transactions).filter((tx) => tx.type === "EXPENSE" && tx.expenseCategoryId);
  const oneTime = new Set((ctx.extras.memory ?? []).filter((m) => m.response === "one-time").map((m) => m.key));
  const out: (Candidate & { ratio: number })[] = [];
  for (const tx of ctx.rawCurrent.transactions) {
    if (tx.type !== "EXPENSE" || !tx.expenseCategoryId || tx.recurringExpenseId) continue;
    const history = past.filter((p) => p.expenseCategoryId === tx.expenseCategoryId && !oneTime.has(`large:${p.id}`));
    if (history.length < LARGE_PURCHASE_MIN_HISTORY) continue;
    const usual = history.reduce((s, p) => s + p.amount, 0) / history.length;
    if (tx.amount < usual * LARGE_PURCHASE_MULTIPLE || tx.amount - usual < LARGE_PURCHASE_MIN_DOLLARS) continue;
    const key = `large:${tx.id}`;
    out.push({
      rule: "large-purchase",
      key,
      fingerprint: tx.amount.toFixed(2),
      text: ctx.t.largePurchase(formatCurrency(tx.amount), tx.name, tx.categoryName ?? "", formatCurrency(usual)),
      priority: PRIORITY.LARGE_PURCHASE,
      ...withPrompt("/transactions", { kind: "large", key, target: tx.id }),
      ratio: tx.amount / usual,
    });
  }
  return out.sort((a, b) => b.ratio - a.ratio);
}

/**
 * The same merchant for about the same amount, about every quincena or
 * month (NEW_RECURRING_GAPS), and not already a recurring expense: "Is
 * this a recurring expense?"
 */
function newRecurringCandidates(ctx: RuleContext): Candidate[] {
  const known = new Set((ctx.extras.recurringExpenseNames ?? []).map((n) => n.trim().toLowerCase()));
  const all = [...ctx.previous.flatMap((f) => f.transactions), ...ctx.rawCurrent.transactions].filter(
    (tx) => tx.type === "EXPENSE" && tx.recurringExpenseId === null,
  );
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const latest of [...ctx.rawCurrent.transactions].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())) {
    if (latest.type !== "EXPENSE" || latest.recurringExpenseId !== null) continue;
    const merchant = latest.name.trim().toLowerCase();
    if (!merchant || known.has(merchant) || seen.has(merchant)) continue;
    const repeat = all.some((other) => {
      if (other.id === latest.id || other.name.trim().toLowerCase() !== merchant) return false;
      if (Math.abs(other.amount - latest.amount) > latest.amount * NEW_RECURRING_AMOUNT_FRACTION) return false;
      const gap = calendarDaysBetween(other.occurredAt, latest.occurredAt);
      return NEW_RECURRING_GAPS.some(([min, max]) => gap >= min && gap <= max);
    });
    if (!repeat) continue;
    seen.add(merchant);
    const key = `new-recurring:${merchant}`;
    out.push({
      rule: "new-recurring",
      key,
      fingerprint: "",
      text: ctx.t.newRecurring(latest.name, formatCurrency(latest.amount)),
      priority: PRIORITY.NEW_RECURRING,
      ...withPrompt("/transactions", { kind: "new-recurring", key, target: latest.id }, { q: latest.name }),
    });
  }
  return out;
}

/** In a cycle's last days, with Safe to spend left over and a goal to put it in: "Move it to a goal?" */
function leftoverCandidates(ctx: RuleContext): Candidate[] {
  const { phase, extras, current } = ctx;
  if (phase.daysRemaining > LEFTOVER_LAST_DAYS || extras.goals.length === 0) return [];
  const left = current.amountLeft - summarizeRecurringExpenses(extras.recurringExpenseCategories).pendingAmount;
  if (left < LEFTOVER_MIN_DOLLARS) return [];
  const key = `leftover:${extras.cycleId}`;
  return [
    {
      rule: "leftover",
      key,
      fingerprint: "",
      text: ctx.t.leftover(formatCurrency(left)),
      priority: PRIORITY.LEFTOVER,
      ...withPrompt("/plan", { kind: "leftover", key, amount: left.toFixed(2) }),
    },
  ];
}

/* ------------------------------ Positives ------------------------------ */

/** "You just passed 50% of your Emergency fund" -- this cycle's contributions crossed a milestone. Once per milestone. */
function goalMilestoneCandidates(ctx: RuleContext): Candidate[] {
  const out: (Candidate & { milestone: number })[] = [];
  for (const goal of ctx.extras.goals) {
    if (goal.lifetimeTargetAmount <= 0 || goal.savedSoFar >= goal.lifetimeTargetAmount) continue;
    const pct = (amount: number) => (amount / goal.lifetimeTargetAmount) * 100;
    const before = pct(goal.savedSoFar - contributedThisCycle(ctx.current, goal.categoryId));
    const crossed = [...GOAL_MILESTONES].reverse().find((m) => before < m && pct(goal.savedSoFar) >= m);
    if (crossed === undefined) continue;
    out.push({
      rule: "goal-milestone",
      key: `goal-milestone:${goal.categoryId}:${crossed}`,
      fingerprint: "",
      text: ctx.t.goalMilestone(crossed, goal.name),
      priority: PRIORITY.GOAL_MILESTONE,
      href: "/plan",
      severity: "positive",
      milestone: crossed,
    });
  }
  return out.sort((a, b) => b.milestone - a.milestone);
}

/**
 * The cycle that just closed ended with money left: "You finished with $X
 * left." Offers moving it to a goal, logged in that closed cycle -- the
 * leftover doesn't roll into this one.
 */
function closedUnderCandidates(ctx: RuleContext): Candidate[] {
  const last = ctx.previous[0];
  const { extras, phase } = ctx;
  if (!last || !extras.lastClosedCycleId || phase.elapsedDays > CLOSED_UNDER_FIRST_DAYS) return [];
  if (last.amountLeft < LEFTOVER_MIN_DOLLARS) return [];
  const key = `closed-under:${extras.lastClosedCycleId}`;
  const amount = last.amountLeft.toFixed(2);
  return [
    {
      rule: "closed-under",
      key,
      fingerprint: amount,
      text: ctx.t.closedUnder(formatCurrency(last.amountLeft)),
      priority: PRIORITY.CLOSED_UNDER,
      severity: "positive",
      ...(extras.goals.length > 0
        ? withPrompt("/plan", { kind: "leftover", key, amount, cycle: extras.lastClosedCycleId })
        : {}),
    },
  ];
}

/** The planned contribution for a goal is met this cycle. */
function goalContributionMadeCandidates(ctx: RuleContext): Candidate[] {
  const { extras, current, t } = ctx;
  return extras.goals
    .filter((goal) => (goal.currentCycleRecurringAmount ?? 0) > 0 && contributedThisCycle(current, goal.categoryId) >= goal.currentCycleRecurringAmount!)
    .map((goal) => ({
      rule: "goal-made",
      key: `goal-made:${extras.cycleId}:${goal.categoryId}`,
      fingerprint: "",
      text: t.goalContributionMade(extras.vocab, formatCurrency(goal.currentCycleRecurringAmount!), goal.name),
      priority: PRIORITY.GOAL_CONTRIBUTION_MADE,
      href: "/plan",
      severity: "positive" as const,
    }));
}

/**
 * Mirror of category up: a category spending less than its prorated usual,
 * with the same floors. Waits for POSITIVE_MIN_PERCENT_ELAPSED of the cycle
 * -- on day 2 every category is "below usual".
 */
function spentLessCandidates(ctx: RuleContext): Candidate[] {
  const { current, previous, phase, extras, t } = ctx;
  if (previous.length < ANOMALY_MIN_HISTORY || phase.percentElapsed < POSITIVE_MIN_PERCENT_ELAPSED) return [];
  const window = previous.slice(0, ANOMALY_WINDOW_SIZE);
  const minAverage = anomalyMinAverage(extras.budgetFrequency);
  const minDollarDelta = anomalyMinDollarDelta(extras.budgetFrequency);
  const categories = new Map(window.flatMap((f) => f.categoryTotals).map((c) => [c.categoryId, c.categoryName]));

  const out: (Candidate & { dollarDelta: number })[] = [];
  for (const [categoryId, categoryName] of categories) {
    const average = window.reduce((s, f) => s + (f.categoryTotals.find((c) => c.categoryId === categoryId)?.amount ?? 0), 0) / window.length;
    if (average < minAverage) continue;
    const expected = average * phase.percentElapsed;
    const spent = current.categoryTotals.find((c) => c.categoryId === categoryId)?.amount ?? 0;
    const dollarDelta = expected - spent;
    if (dollarDelta < minDollarDelta || dollarDelta / expected < ANOMALY_THRESHOLD_FRACTION) continue;
    out.push({
      rule: "spent-less",
      key: `spent-less:${extras.cycleId}:${categoryId}`,
      fingerprint: "",
      text: t.spentLess(categoryName, formatCurrency(dollarDelta)),
      priority: PRIORITY.SPENT_LESS,
      href: `/transactions?category=${categoryId}`,
      severity: "positive",
      dollarDelta,
    });
  }
  return out.sort((a, b) => b.dollarDelta - a.dollarDelta);
}

/**
 * Halfway or later, day-to-day spending well under pace: how much more the
 * user has than expected. Expected spending so far = what was spendable at
 * the start (Safe to spend + day-to-day spent) times how far in we are.
 */
function aheadOfPaceCandidates(ctx: RuleContext): Candidate[] {
  const { current, phase, extras, t } = ctx;
  if (phase.percentElapsed < POSITIVE_MIN_PERCENT_ELAPSED) return [];
  const safeToSpend = current.amountLeft - summarizeRecurringExpenses(extras.recurringExpenseCategories).pendingAmount;
  if (safeToSpend <= 0) return [];
  const dayToDaySpent = current.transactions
    .filter((tx) => tx.type === "EXPENSE" && tx.recurringExpenseId === null)
    .reduce((sum, tx) => sum + tx.amount, 0);
  const expected = (safeToSpend + dayToDaySpent) * phase.percentElapsed;
  const ahead = expected - dayToDaySpent;
  if (ahead < AHEAD_OF_PACE_MIN_DOLLARS || ahead < expected * AHEAD_OF_PACE_MIN_FRACTION) return [];
  return [
    {
      rule: "ahead",
      key: `ahead:${extras.cycleId}`,
      fingerprint: "",
      text: t.aheadOfPace(formatCurrency(ahead)),
      priority: PRIORITY.AHEAD_OF_PACE,
      href: "/transactions/breakdown",
      severity: "positive",
    },
  ];
}

/**
 * Consecutive closed cycles (newest first) each spending less than the
 * average of the up-to-ANOMALY_WINDOW_SIZE cycles before it.
 */
function streakCandidates(ctx: RuleContext): Candidate[] {
  const { previous, extras, t } = ctx;
  let streak = 0;
  for (let i = 0; i < previous.length - 1; i++) {
    const before = previous.slice(i + 1, i + 1 + ANOMALY_WINDOW_SIZE);
    const usual = before.reduce((s, f) => s + f.totalExpenses, 0) / before.length;
    if (!(previous[i].totalExpenses < usual)) break;
    streak++;
  }
  if (streak < STREAK_MIN_CYCLES) return [];
  return [
    {
      rule: "streak",
      key: `streak:${extras.cycleId}`,
      fingerprint: String(streak),
      text: t.streak(streak),
      priority: PRIORITY.STREAK,
      severity: "positive",
    },
  ];
}
