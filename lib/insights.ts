import type { CycleFinancials } from "@/lib/cycle-financials";
import { formatCurrency, formatFriendlyDate } from "@/lib/format";
import { addDays, nowInPanama, panamaDateParts, parseDateOnly } from "@/lib/pay-date";
import { calendarDaysBetween, cycleEnd, type BudgetFrequency } from "@/lib/quincena-pace";
import type { CategoryWithRecurringExpenses } from "@/lib/recurring-expenses";
import { getRecurringExpensePaymentStatus } from "@/lib/recurring-expense-status";
import type { GoalWithProgress } from "@/lib/goals";
import { computeGoalProjection } from "@/lib/goal-projection";
import type { Dictionary, PeriodVocab } from "@/lib/i18n/dictionary";

type InsightsDictionary = Dictionary["insights"];

export interface Insight {
  text: string;
  /** Present when this insight has a natural destination (e.g. the Plan tab) -- absent for insights with nothing to link to, which InsightsCard renders as plain text. */
  href?: string;
  /** Drives InsightsCard's severity dot -- "critical" for runway/over-budget concerns, "warning" for unpaid-bill concerns, absent (neutral dot) for everything else (on-track, streaks, anomalies, goal progress -- informational, not something gone wrong). */
  severity?: "critical" | "warning";
}

/** A rule's raw output before the priority sort picks the final 3 -- never returned directly, see generateInsights. */
interface Candidate {
  text: string;
  priority: number;
  href?: string;
  severity?: "critical" | "warning";
}

/**
 * Relative priority each rule's candidate competes at for one of the final
 * 3 slots -- higher wins. Ordering intent (exact numbers are tunable):
 * unpaid recurring expenses is time-sensitive and directly actionable, so
 * it outranks everything; a real category anomaly and a pacing warning are
 * both more worth surfacing than a routine restatement; the plain on-track
 * line and the streak stay useful but no longer win a slot just because
 * they always apply.
 */
const PRIORITY = {
  DUE_SOON: 95,
  // Above UNPAID_RECURRING (was below it) -- time-aware and personalized in
  // a way the flat unpaid-count never is, so it should win the slot when
  // both apply. See paceAwareCandidate's own comment.
  PACE_WARNING: 92,
  UNPAID_RECURRING: 90,
  DUPLICATE_CHARGE: 88,
  CATEGORY_ANOMALY: 80,
  GOAL_CONTRIBUTION: 72,
  OVER_BUDGET: 70,
  SAVINGS_GOAL: 60,
  ON_TRACK: 40,
} as const;

/** How far (as a fraction of a category's own recent average) this cycle's spend has to move before it's worth calling out -- a $5 swing means something different for a $10/cycle category than a $500/cycle one, so this is relative, not a flat dollar amount. */
const ANOMALY_THRESHOLD_FRACTION = 0.2;
/** How many closed cycles' rolling average to compare against (matches how many the dashboard already fetches via getRecentCycles). */
const ANOMALY_WINDOW_SIZE = 4;
/** Minimum closed cycles of history required before the rolling-average rule runs at all -- below this, categoryAnomalyCandidate falls back to the older single-previous-cycle comparison so a newer user still sees something. */
const ANOMALY_MIN_HISTORY = 2;
/** Below this dollar delta (actual vs. this cycle's prorated expected spend), a category swing isn't worth mentioning even if it clears the relative threshold -- without this, a $4/cycle category ticking up to $5 (a 25% relative swing) would beat a genuine $200 grocery overage. Roughly doubled for MONTHLY: a cycle spanning a full month naturally carries bigger swings than a quincena's, so the same flat floor would fire far too often. */
function anomalyMinDollarDelta(budgetFrequency: BudgetFrequency): number {
  return budgetFrequency === "MONTHLY" ? 30 : 15;
}
/** Categories averaging less than this per cycle are too small to bother flagging at all -- same reasoning as anomalyMinDollarDelta, applied to the baseline itself, and roughly doubled for MONTHLY for the same reason. */
function anomalyMinAverage(budgetFrequency: BudgetFrequency): number {
  return budgetFrequency === "MONTHLY" ? 50 : 25;
}
/** How close (as % of a savings goal's lifetime target) progress has to be before it's worth calling out -- skips a goal that's barely started, which would otherwise read as "you're 90% short" framed as good news. Lowered from 80: by 80% a user is already well past the point of finding this exciting news. */
const SAVINGS_GOAL_PROXIMITY_THRESHOLD_PERCENT = 60;
/** How many days out (in either direction -- "due in N days" or "N days overdue") a MONTHLY recurring expense's own due day has to fall within, unpaid, before it's worth a dedicated call-out. */
const DUE_SOON_WITHIN_DAYS = 3;
/** unpaidRecurringCandidate doesn't fire before this fraction of the cycle has elapsed (unless a specific bill is already overdue -- see its own comment) -- every recurring expense is "unpaid" on day 1 by definition, so firing immediately is true but useless, and would occupy the #1 slot for the first half of every quincena. */
const UNPAID_RECURRING_MIN_PERCENT_ELAPSED = 0.5;
/** goalContributionCandidate doesn't fire before this fraction of the cycle has elapsed -- a goal contribution logged anytime this cycle still counts, so there's nothing to flag until enough of the cycle has passed that "haven't moved it yet" actually means something. */
const GOAL_CONTRIBUTION_MIN_PERCENT_ELAPSED = 0.6;
/** goalContributionCandidate fires when actual contribution is below this fraction of what was planned for the cycle. */
const GOAL_CONTRIBUTION_THRESHOLD_FRACTION = 0.5;
/** duplicateChargeCandidate treats two same-merchant, same-amount Gmail imports as a possible duplicate when they land within this many days of each other. */
const DUPLICATE_CHARGE_WITHIN_DAYS = 3;

/**
 * Rule-based insights from real cycle history — no LLM call. Each rule
 * below produces at most one candidate (or none, if it doesn't apply);
 * candidates are sorted by priority and the top 3 win a slot, so which
 * "shapes" of sentence show up varies cycle to cycle based on what's
 * actually notable, rather than a fixed rule order always winning the
 * same slots. `previousClosedFinancials` must be ordered newest-first (as
 * getRecentCycles already returns).
 */
export function generateInsights(
  current: CycleFinancials,
  previousClosedFinancials: CycleFinancials[],
  extras: {
    /** The current cycle's own date range -- periodEnd is only ever set once a cycle is closed, so an open cycle's nominal end is derived from periodStart via cycleEnd, same convention formatCycleRangeText already uses. */
    cycle: { periodStart: Date; periodEnd: Date | null };
    /** This cycle's Recurring Expenses breakdown, e.g. from getRecurringExpensesForCycle -- drives the unpaid-recurring-expenses rule. */
    recurringExpenseCategories: CategoryWithRecurringExpenses[];
    /** The user's savings goals with progress, e.g. from getGoalsWithProgress -- drives the savings-goal-proximity rule. */
    goals: GoalWithProgress[];
    /** The user's own pay-cadence setting -- only matters for deriving a still-open cycle's nominal end (see cyclePhase) and a goal's projected ETA; every rule that just compares dollar amounts is unaffected. */
    budgetFrequency: BudgetFrequency;
    /** Resolved from budgetFrequency by the caller (which has the full Dictionary in scope, unlike this plain function) -- feeds the one rule sentence that names the cadence ("quincena"/"month"). */
    vocab: PeriodVocab;
    /** Defaults to nowInPanama() -- overridable for tests. */
    now?: Date;
    /** This is a plain function (no useT()), so the caller threads the resolved dictionary's `insights` slice through here instead. */
    t: InsightsDictionary;
  },
): Insight[] {
  const now = extras.now ?? nowInPanama();
  const phase = cyclePhase(extras.cycle, extras.budgetFrequency, now);
  const t = extras.t;
  const candidates: Candidate[] = [];

  const dueSoon = dueSoonCandidate(now, extras.recurringExpenseCategories, t);
  if (dueSoon) candidates.push(dueSoon);

  const unpaidRecurring = unpaidRecurringCandidate(extras.recurringExpenseCategories, now, phase, t);
  if (unpaidRecurring) candidates.push(unpaidRecurring);

  const duplicateCharge = duplicateChargeCandidate(current, t);
  if (duplicateCharge) candidates.push(duplicateCharge);

  const categoryAnomaly = categoryAnomalyCandidate(current, previousClosedFinancials, phase, extras.budgetFrequency, t);
  if (categoryAnomaly) candidates.push(categoryAnomaly);

  candidates.push(paceAwareCandidate(current, phase, now, t));

  const goalContribution = goalContributionCandidate(extras.goals, current, phase, extras.vocab, t);
  if (goalContribution) candidates.push(goalContribution);

  const savingsGoal = savingsGoalCandidate(extras.goals, now, extras.budgetFrequency, t);
  if (savingsGoal) candidates.push(savingsGoal);

  // Capped at 2, not 3 -- with the fuller rule set above, most cycles now
  // legitimately have 0-2 things worth saying; a 3rd slot just means
  // reaching further down the priority list for something less urgent.
  // Streak deliberately isn't a candidate here at all anymore -- see
  // computeStreak's own comment for where it moved.
  return candidates
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 2)
    .map(({ text, href, severity }) => ({ text, ...(href ? { href } : {}), ...(severity ? { severity } : {}) }));
}

interface CyclePhase {
  totalDays: number;
  elapsedDays: number;
  daysRemaining: number;
  /** 0 (just started) to 1 (last day) -- how far through the cycle `now` falls. */
  percentElapsed: number;
}

/** Shared by every rule that needs to know how far into the cycle `now` is -- previously computed inline, only inside paceAwareCandidate. */
function cyclePhase(
  cycle: { periodStart: Date; periodEnd: Date | null },
  budgetFrequency: BudgetFrequency,
  now: Date,
): CyclePhase {
  const resolvedCycleEnd = cycle.periodEnd ?? cycleEnd(cycle.periodStart, budgetFrequency);
  const totalDays = calendarDaysBetween(cycle.periodStart, resolvedCycleEnd) + 1;
  const elapsedDays = Math.min(Math.max(calendarDaysBetween(cycle.periodStart, now) + 1, 1), totalDays);
  const daysRemaining = Math.max(totalDays - elapsedDays, 0);
  return { totalDays, elapsedDays, daysRemaining, percentElapsed: elapsedDays / totalDays };
}

/** How many days until (positive) or since (negative) a MONTHLY expense's dueDay falls this month -- null when dueDay doesn't exist in the current month (e.g. 31st in a 30-day month). Shared by dueSoonCandidate and unpaidRecurringCandidate's own overdue check. */
function daysUntilMonthlyDue(now: Date, dueDay: number): number | null {
  const { year, month } = panamaDateParts(now);
  const dueDateStr = `${year}-${String(month).padStart(2, "0")}-${String(dueDay).padStart(2, "0")}`;
  const dueDate = parseDateOnly(dueDateStr);
  if (!dueDate) return null;
  return calendarDaysBetween(now, dueDate);
}

/**
 * Names the single most urgent still-unpaid MONTHLY recurring expense whose
 * own due day falls within DUE_SOON_WITHIN_DAYS of today (including
 * already-overdue) -- dueDay has always been captured (see
 * RecurringExpenseEditSheet) but never surfaced anywhere a user just
 * glances at the list; this is the one place it actually changes what
 * someone does. Only ever names the single most urgent one (never a count,
 * unlike unpaidRecurringCandidate) since "which one, and when" is the whole
 * point. BIWEEKLY expenses have no fixed calendar day to compare against,
 * so they're not eligible here.
 */
function dueSoonCandidate(now: Date, categories: CategoryWithRecurringExpenses[], t: InsightsDictionary): Candidate | null {
  let best: { name: string; amount: number; daysUntilDue: number } | null = null;

  for (const category of categories) {
    for (const expense of category.expenses) {
      if (expense.frequency !== "MONTHLY" || expense.dueDay === null) continue;
      const status = getRecurringExpensePaymentStatus(expense.actual, expense.targetAmount);
      if (status !== "not-started" && status !== "partial") continue;

      const daysUntilDue = daysUntilMonthlyDue(now, expense.dueDay);
      if (daysUntilDue === null) continue; // e.g. dueDay 31 in a 30-day month -- nothing to compare this cycle.
      if (daysUntilDue > DUE_SOON_WITHIN_DAYS || daysUntilDue < -DUE_SOON_WITHIN_DAYS) continue;

      if (!best || daysUntilDue < best.daysUntilDue) {
        best = { name: expense.name, amount: expense.targetAmount - expense.actual, daysUntilDue };
      }
    }
  }

  if (!best) return null;
  const dueText =
    best.daysUntilDue === 0
      ? t.dueToday
      : best.daysUntilDue === 1
        ? t.dueTomorrow
        : best.daysUntilDue > 1
          ? t.dueInDays(best.daysUntilDue)
          : best.daysUntilDue === -1
            ? t.wasDueYesterday
            : t.wasDueDaysAgo(Math.abs(best.daysUntilDue));

  return {
    text: t.billDueSoon(best.name, formatCurrency(best.amount), dueText),
    priority: PRIORITY.DUE_SOON,
    href: "/plan",
    severity: "warning",
  };
}

/**
 * Counts this cycle's recurring expenses still "not-started" or "partial"
 * (see lib/recurring-expense-status.ts) and sums what's left to pay on
 * each (target minus actual, floored at 0 -- a recurring expense already
 * paid past its target contributes nothing here). The highest-value gap
 * this rework closes: Insights previously had no idea Recurring Expenses
 * existed at all.
 *
 * Gated by UNPAID_RECURRING_MIN_PERCENT_ELAPSED unless a specific MONTHLY
 * expense's own due day has already passed -- every recurring expense is
 * "unpaid" by definition on day 1 of a cycle, so firing immediately is
 * true but useless (see dueSoonCandidate for the single-account version of
 * this same signal, which fires regardless of cycle phase since it names a
 * real deadline rather than restating the obvious).
 */
function unpaidRecurringCandidate(
  categories: CategoryWithRecurringExpenses[],
  now: Date,
  phase: CyclePhase,
  t: InsightsDictionary,
): Candidate | null {
  let count = 0;
  let remaining = 0;
  let hasOverdue = false;
  for (const category of categories) {
    for (const expense of category.expenses) {
      const status = getRecurringExpensePaymentStatus(expense.actual, expense.targetAmount);
      if (status === "not-started" || status === "partial") {
        count++;
        remaining += Math.max(expense.targetAmount - expense.actual, 0);
        if (expense.frequency === "MONTHLY" && expense.dueDay !== null) {
          const daysUntilDue = daysUntilMonthlyDue(now, expense.dueDay);
          if (daysUntilDue !== null && daysUntilDue <= 0) hasOverdue = true;
        }
      }
    }
  }
  if (count === 0) return null;
  if (phase.percentElapsed < UNPAID_RECURRING_MIN_PERCENT_ELAPSED && !hasOverdue) return null;

  return {
    text: t.unpaidRecurring(count, formatCurrency(remaining)),
    priority: PRIORITY.UNPAID_RECURRING,
    href: "/plan",
    severity: "warning",
  };
}

/**
 * N6 -- flags two Gmail-imported transactions from the same merchant, for
 * the same amount, landing within DUPLICATE_CHARGE_WITHIN_DAYS of each
 * other, as a possible double-charge. Manual entries are excluded on both
 * sides -- a user typing the same amount for the same place twice (e.g. two
 * separate trips to the same coffee shop) is normal and not evidence of
 * anything; Gmail-Gmail is the pairing that actually suggests a bank/vendor
 * error rather than two real purchases. Only ever reports the first
 * qualifying pair found -- "is there a duplicate at all" is the question,
 * not an exhaustive audit.
 */
function duplicateChargeCandidate(current: CycleFinancials, t: InsightsDictionary): Candidate | null {
  const gmailTransactions = current.transactions.filter(
    (tx) => tx.importSource === "GMAIL" && tx.type === "EXPENSE",
  );

  for (let i = 0; i < gmailTransactions.length; i++) {
    for (let j = i + 1; j < gmailTransactions.length; j++) {
      const a = gmailTransactions[i];
      const b = gmailTransactions[j];
      if (a.amount !== b.amount) continue;
      const nameA = a.name.trim().toLowerCase();
      const nameB = b.name.trim().toLowerCase();
      if (!nameA || nameA !== nameB) continue;
      if (Math.abs(calendarDaysBetween(a.occurredAt, b.occurredAt)) > DUPLICATE_CHARGE_WITHIN_DAYS) continue;

      const later = a.occurredAt > b.occurredAt ? a : b;
      return {
        text: t.duplicateCharge(formatCurrency(a.amount), a.name, formatFriendlyDate(later.occurredAt)),
        priority: PRIORITY.DUPLICATE_CHARGE,
        href: `/transactions?q=${encodeURIComponent(a.name)}`,
      };
    }
  }

  return null;
}

/**
 * Replaces the old flat "top category vs. single previous cycle" delta
 * with a rolling average over the last 2-4 closed cycles, so a big/stable/
 * expected expense (rent) doesn't permanently occupy the slot while
 * something actually unusual elsewhere never gets mentioned, and a single
 * noisy prior cycle can't make an otherwise-normal category look like a
 * swing. Picks whichever category (among ALL with spend this cycle, not
 * just the #1 by raw dollars) has the largest RELATIVE deviation from its
 * own average -- a $5 swing means something different for a $10/cycle
 * category than a $500/cycle one. Requires at least ANOMALY_MIN_HISTORY
 * closed cycles; with less, falls back to categoryDeltaFallback so a newer
 * user still sees something rather than nothing. Matches by categoryId,
 * never name, in both paths -- survives a rename and never false-matches
 * two different categories sharing a name.
 */
function categoryAnomalyCandidate(
  current: CycleFinancials,
  previousClosedFinancials: CycleFinancials[],
  phase: CyclePhase,
  budgetFrequency: BudgetFrequency,
  t: InsightsDictionary,
): Candidate | null {
  if (previousClosedFinancials.length < ANOMALY_MIN_HISTORY) {
    return categoryDeltaFallback(current, previousClosedFinancials, t);
  }

  const window = previousClosedFinancials.slice(0, ANOMALY_WINDOW_SIZE);
  const minAverage = anomalyMinAverage(budgetFrequency);
  const minDollarDelta = anomalyMinDollarDelta(budgetFrequency);
  let best: { categoryId: string; categoryName: string; amount: number; expected: number; relativeDelta: number } | null = null;

  for (const category of current.categoryTotals) {
    const sum = window.reduce((total, cycle) => {
      const match = cycle.categoryTotals.find((c) => c.categoryId === category.categoryId);
      return total + (match?.amount ?? 0);
    }, 0);
    const average = sum / window.length;
    if (average < minAverage) continue; // Too small a category to matter either way.

    // `average` is a FULL-cycle number from window cycles that already
    // closed; `category.amount` is only what's posted so far THIS cycle,
    // which may still be open. Comparing a partial total against a
    // full-cycle average makes almost every category look like a huge
    // swing for the first half of every quincena -- prorate the baseline
    // down to "what we'd expect to have spent by now at that same pace."
    const expected = average * phase.percentElapsed;
    if (expected <= 0) continue;

    const dollarDelta = category.amount - expected;
    // A dollar floor on top of the relative one -- without it, a $4/cycle
    // category ticking up to $5 (a 25% relative swing) beats a genuine
    // $200 overage in a bigger category. See anomalyMinDollarDelta.
    if (dollarDelta < minDollarDelta) continue;

    const relativeDelta = dollarDelta / expected;
    // Only an increase is actionable -- a category quietly spending LESS
    // than usual isn't something a user needs to be told to look into.
    if (relativeDelta < ANOMALY_THRESHOLD_FRACTION) continue;
    if (!best || relativeDelta > best.relativeDelta) {
      best = { categoryId: category.categoryId, categoryName: category.categoryName, amount: category.amount, expected, relativeDelta };
    }
  }

  if (!best) return null;
  return {
    text: t.categoryAnomaly(best.categoryName, formatCurrency(best.amount - best.expected)),
    priority: PRIORITY.CATEGORY_ANOMALY,
    href: `/transactions?category=${best.categoryId}`,
  };
}

/** The original single-previous-cycle comparison -- kept as the under-2-closed-cycles fallback for categoryAnomalyCandidate. */
function categoryDeltaFallback(
  current: CycleFinancials,
  previousClosedFinancials: CycleFinancials[],
  t: InsightsDictionary,
): Candidate | null {
  if (previousClosedFinancials.length === 0) return null;
  const mostRecent = previousClosedFinancials[0];
  const topCategory = current.topCategories[0];
  if (!topCategory) return null;

  const previousForCategory = mostRecent.categoryTotals.find((c) => c.categoryId === topCategory.categoryId);
  if (!previousForCategory) return null;

  const delta = topCategory.amount - previousForCategory.amount;
  // Only an increase is actionable -- see categoryAnomalyCandidate's own comment.
  if (delta < 1) return null;

  return {
    text: t.categoryDelta(topCategory.categoryName, formatCurrency(delta)),
    priority: PRIORITY.CATEGORY_ANOMALY,
    href: `/transactions?category=${topCategory.categoryId}`,
  };
}

/**
 * The on-track/over-budget line, now pace-aware -- and, unlike the old
 * version, never just repeats HeroCard's own headline number. A flat
 * balance check means very different things on day 2 of a quincena versus
 * day 13, so once genuinely over budget is ruled out, this extrapolates
 * today's own average daily spend forward: if that rate would exhaust
 * amountLeft before the cycle actually ends, it names the real projected
 * day that happens ("you'll run out of cash around Aug 14") instead of the
 * old flat "X% of budget used" framing -- a concrete date is something a
 * user can actually act on, and it's never a restatement of a number
 * already on screen (HeroCard shows today's balance, this projects a
 * future one). Only when the projection clears the whole cycle does this
 * fall back to a plain reassurance, deliberately with no dollar figure in
 * it. Always produces a candidate, but no longer reserves itself a top-3
 * slot; with more rules producing candidates, a cycle with more urgent
 * things going on can simply not mention pace at all.
 */
function paceAwareCandidate(current: CycleFinancials, phase: CyclePhase, now: Date, t: InsightsDictionary): Candidate {
  if (current.amountLeft < 0) {
    return {
      text: t.overBudget(formatCurrency(Math.abs(current.amountLeft)), phase.daysRemaining),
      priority: PRIORITY.OVER_BUDGET,
      severity: "critical",
    };
  }

  const dailyRate = current.totalExpenses / phase.elapsedDays;
  if (dailyRate > 0) {
    const daysUntilExhausted = current.amountLeft / dailyRate;
    if (daysUntilExhausted < phase.daysRemaining) {
      const runOutDate = addDays(now, Math.floor(daysUntilExhausted));
      const daysBeforePayday = phase.daysRemaining - Math.floor(daysUntilExhausted);
      return {
        text: t.runOutOfCash(formatFriendlyDate(runOutDate), daysBeforePayday),
        priority: PRIORITY.PACE_WARNING,
        href: "/dashboard/breakdown",
        severity: "critical",
      };
    }
  }

  return {
    text: t.onTrackPace,
    priority: PRIORITY.ON_TRACK,
  };
}

/**
 * Counts consecutive (newest-first) closed cycles finishing with
 * amountLeft >= 0, stopping at the first that didn't -- the same counting
 * logic this used to run as its own dashboard Insights candidate. Moved out
 * to a plain exported function (no longer a Candidate-producing rule here
 * at all): a streak is being WON the moment a cycle closes, so it now
 * renders on CycleClosedCard instead, right when it's actually earned,
 * rather than competing all cycle long for an Insights slot most users with
 * 2+ other things going on would never see it win anyway.
 */
export function computeStreak(previousClosedFinancials: CycleFinancials[]): number {
  let streak = 0;
  for (const cycle of previousClosedFinancials) {
    if (cycle.amountLeft < 0) break;
    streak++;
  }
  return streak;
}

/**
 * Surfaces whichever active savings goal is closest to its lifetime
 * target (within SAVINGS_GOAL_PROXIMITY_THRESHOLD_PERCENT%), skipping
 * anything already complete or still far off -- announcing "you're 90%
 * short" as if it were exciting news isn't the point of this rule.
 */
function savingsGoalCandidate(
  goals: GoalWithProgress[],
  now: Date,
  budgetFrequency: BudgetFrequency,
  t: InsightsDictionary,
): Candidate | null {
  let best: { name: string; remaining: number; percentage: number } | null = null;

  for (const goal of goals) {
    const projection = computeGoalProjection({
      savedSoFar: goal.savedSoFar,
      lifetimeTargetAmount: goal.lifetimeTargetAmount,
      currentCycleRecurringAmount: goal.currentCycleRecurringAmount,
      now,
      frequency: budgetFrequency,
    });
    if (projection.isComplete) continue;
    if (projection.percentage < SAVINGS_GOAL_PROXIMITY_THRESHOLD_PERCENT) continue;
    if (!best || projection.percentage > best.percentage) {
      best = { name: goal.name, remaining: projection.remaining, percentage: projection.percentage };
    }
  }

  if (!best) return null;
  return {
    text: t.savingsGoalClose(formatCurrency(best.remaining), best.name),
    priority: PRIORITY.SAVINGS_GOAL,
    href: "/plan",
  };
}

/**
 * N2 -- the plan-vs-actual savings gap savingsGoalCandidate can't see: a
 * goal can have a real per-cycle contribution planned (CycleBudgetGoal for
 * a SAVINGS category) with nothing actually logged toward it yet this
 * cycle, and savingsGoalCandidate (lifetime-progress-based) has no way to
 * notice -- a goal that's 85% of the way to its lifetime target still
 * reads as "on track" there even if this specific quincena's own
 * contribution never happened. Scoped to `current`'s own transactions
 * (not GoalWithProgress.savedSoFar, which is an all-time sum) so this is
 * really asking "did THIS cycle's plan happen," not "is the goal overall
 * behind." Gated by GOAL_CONTRIBUTION_MIN_PERCENT_ELAPSED -- a
 * contribution logged any time this cycle still counts, so there's
 * nothing to flag until enough of the cycle has passed that "hasn't
 * happened yet" is actually true rather than merely not-yet-true.
 */
function goalContributionCandidate(
  goals: GoalWithProgress[],
  current: CycleFinancials,
  phase: CyclePhase,
  vocab: PeriodVocab,
  t: InsightsDictionary,
): Candidate | null {
  if (phase.percentElapsed < GOAL_CONTRIBUTION_MIN_PERCENT_ELAPSED) return null;

  let best: { name: string; planned: number; actual: number; shortfall: number } | null = null;
  for (const goal of goals) {
    const planned = goal.currentCycleRecurringAmount;
    if (!planned || planned <= 0) continue;

    const actual = current.transactions
      .filter((tx) => tx.type === "SAVINGS" && tx.expenseCategoryId === goal.categoryId)
      .reduce((sum, tx) => sum + tx.amount, 0);
    if (actual >= planned * GOAL_CONTRIBUTION_THRESHOLD_FRACTION) continue;

    const shortfall = planned - actual;
    if (!best || shortfall > best.shortfall) {
      best = { name: goal.name, planned, actual, shortfall };
    }
  }

  if (!best) return null;
  return {
    text: t.goalContributionBehind(vocab, formatCurrency(best.planned), formatCurrency(best.actual), best.name, phase.daysRemaining),
    priority: PRIORITY.GOAL_CONTRIBUTION,
    href: "/plan",
  };
}
