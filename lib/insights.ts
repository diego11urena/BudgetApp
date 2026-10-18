import type { CycleFinancials } from "@/lib/cycle-financials";
import { formatCurrency, formatFriendlyDate, formatShortDate } from "@/lib/format";
import type { LocaleValue } from "@/lib/i18n/locale";
import { addDays, nearestMonthlyDueDate, nowInPanama } from "@/lib/pay-date";
import { calendarDaysBetween, cycleEnd, type BudgetFrequency } from "@/lib/quincena-pace";
import { summarizeRecurringExpenses, type CategoryWithRecurringExpenses } from "@/lib/recurring-expenses";
import type { GoalWithProgress } from "@/lib/goals";
import { computeGoalProjection } from "@/lib/goal-projection";
import type { Dictionary, PeriodVocab } from "@/lib/i18n/dictionary";
import { promptHref } from "@/lib/insight-prompts";

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
  CATEGORY_ANOMALY: 80,
  GOAL_CONTRIBUTION: 72,
  UPCOMING_CHARGES: 65,
  SAVINGS_GOAL: 60,
  STILL_TO_CHARGE: 55,
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

/* ------------------------------------------------------------------ */

export type InsightSeverity = "critical" | "recurring";

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
}

interface Candidate extends Insight {
  priority: number;
  /** Which rule produced it -- at most one per rule reaches the card. */
  rule: string;
  /** Has a follow-up prompt -- wins ties. */
  actionable?: boolean;
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
  const ctx: RuleContext = {
    current,
    previous: previousClosedFinancials,
    extras,
    now,
    t: extras.t,
    locale: extras.locale ?? "en",
    phase: cyclePhase(extras.cycle, extras.budgetFrequency, now),
  };

  const candidates = [
    ...upcomingChargesCandidates(ctx),
    ...missedChargeCandidates(ctx),
    ...stillToChargeCandidates(ctx),
    ...duplicateChargeCandidates(ctx),
    ...categoryAnomalyCandidates(ctx),
    ...paceCandidates(ctx),
    ...goalContributionCandidates(ctx),
    ...savingsGoalCandidates(ctx),
  ];

  const memory = extras.memory ?? [];
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
  current: CycleFinancials;
  previous: CycleFinancials[];
  extras: InsightExtras;
  now: Date;
  t: InsightsDictionary;
  locale: LocaleValue;
  phase: CyclePhase;
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
        href: "/plan",
        severity: "recurring" as const,
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
      href: `/transactions?category=${category.categoryId}`,
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
 * target, or a milestone (GOAL_MILESTONES) crossed by this cycle's
 * contributions. Neither holds forever: the first ends when the goal is
 * done, the second when the cycle closes.
 */
function savingsGoalCandidates(ctx: RuleContext): Candidate[] {
  const { extras, current, now, t } = ctx;
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
    const withinOneContribution = planned > 0 && projection.remaining <= planned;
    const before = ((goal.savedSoFar - contributedThisCycle(current, goal.categoryId)) / goal.lifetimeTargetAmount) * 100;
    const crossed = [...GOAL_MILESTONES].reverse().find((m) => before < m && projection.percentage >= m);
    if (!withinOneContribution && crossed === undefined) continue;

    out.push({
      rule: "goal-close",
      key: `goal-close:${goal.categoryId}`,
      fingerprint: withinOneContribution ? `remaining:${projection.remaining.toFixed(2)}` : `milestone:${crossed}`,
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
