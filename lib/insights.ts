import type { CycleFinancials } from "@/lib/cycle-financials";
import { formatCurrency, formatFriendlyDate } from "@/lib/format";
import { addDays, nowInPanama, panamaDateParts, parseDateOnly } from "@/lib/pay-date";
import { calendarDaysBetween, quincenaEnd } from "@/lib/quincena-pace";
import type { CategoryWithRecurringExpenses } from "@/lib/recurring-expenses";
import { getRecurringExpensePaymentStatus } from "@/lib/recurring-expense-status";
import type { GoalWithProgress } from "@/lib/goals";
import { computeGoalProjection } from "@/lib/goal-projection";

export interface Insight {
  text: string;
  /** Present when this insight has a natural destination (e.g. the Recurring Expenses tab) -- absent for insights with nothing to link to (e.g. the streak), which InsightsCard renders as plain text. */
  href?: string;
}

/** A rule's raw output before the priority sort picks the final 3 -- never returned directly, see generateInsights. */
interface Candidate {
  text: string;
  priority: number;
  href?: string;
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
  UNPAID_RECURRING: 90,
  CATEGORY_ANOMALY: 80,
  PACE_WARNING: 75,
  OVER_BUDGET: 70,
  SAVINGS_GOAL: 60,
  ON_TRACK: 40,
  STREAK: 35,
} as const;

/** How far (as a fraction of a category's own recent average) this cycle's spend has to move before it's worth calling out -- a $5 swing means something different for a $10/cycle category than a $500/cycle one, so this is relative, not a flat dollar amount. */
const ANOMALY_THRESHOLD_FRACTION = 0.2;
/** How many closed cycles' rolling average to compare against (matches how many the dashboard already fetches via getRecentCycles). */
const ANOMALY_WINDOW_SIZE = 4;
/** Minimum closed cycles of history required before the rolling-average rule runs at all -- below this, categoryAnomalyCandidate falls back to the older single-previous-cycle comparison so a newer user still sees something. */
const ANOMALY_MIN_HISTORY = 2;
/** How close (as % of a savings goal's lifetime target) progress has to be before it's worth calling out -- skips a goal that's barely started, which would otherwise read as "you're 90% short" framed as good news. */
const SAVINGS_GOAL_PROXIMITY_THRESHOLD_PERCENT = 80;
/** How many days out (in either direction -- "due in N days" or "N days overdue") a MONTHLY recurring expense's own due day has to fall within, unpaid, before it's worth a dedicated call-out. */
const DUE_SOON_WITHIN_DAYS = 3;

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
    /** The current cycle's own date range -- periodEnd is only ever set once a cycle is closed, so an open cycle's nominal end is derived from periodStart via quincenaEnd, same convention formatCycleRangeText already uses. */
    cycle: { periodStart: Date; periodEnd: Date | null };
    /** This cycle's Recurring Expenses breakdown, e.g. from getRecurringExpensesForCycle -- drives the unpaid-recurring-expenses rule. */
    recurringExpenseCategories: CategoryWithRecurringExpenses[];
    /** The user's savings goals with progress, e.g. from getGoalsWithProgress -- drives the savings-goal-proximity rule. */
    goals: GoalWithProgress[];
    /** Defaults to nowInPanama() -- overridable for tests. */
    now?: Date;
  },
): Insight[] {
  const now = extras.now ?? nowInPanama();
  const candidates: Candidate[] = [];

  const dueSoon = dueSoonCandidate(now, extras.recurringExpenseCategories);
  if (dueSoon) candidates.push(dueSoon);

  const unpaidRecurring = unpaidRecurringCandidate(extras.recurringExpenseCategories);
  if (unpaidRecurring) candidates.push(unpaidRecurring);

  const categoryAnomaly = categoryAnomalyCandidate(current, previousClosedFinancials);
  if (categoryAnomaly) candidates.push(categoryAnomaly);

  candidates.push(paceAwareCandidate(current, extras.cycle, now));

  const streak = streakCandidate(previousClosedFinancials);
  if (streak) candidates.push(streak);

  const savingsGoal = savingsGoalCandidate(extras.goals, now);
  if (savingsGoal) candidates.push(savingsGoal);

  return candidates
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3)
    .map(({ text, href }) => (href ? { text, href } : { text }));
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
function dueSoonCandidate(now: Date, categories: CategoryWithRecurringExpenses[]): Candidate | null {
  const { year, month } = panamaDateParts(now);
  let best: { name: string; amount: number; daysUntilDue: number } | null = null;

  for (const category of categories) {
    for (const expense of category.expenses) {
      if (expense.frequency !== "MONTHLY" || expense.dueDay === null) continue;
      const status = getRecurringExpensePaymentStatus(expense.actual, expense.targetAmount);
      if (status !== "not-started" && status !== "partial") continue;

      const dueDateStr = `${year}-${String(month).padStart(2, "0")}-${String(expense.dueDay).padStart(2, "0")}`;
      const dueDate = parseDateOnly(dueDateStr);
      if (!dueDate) continue; // e.g. dueDay 31 in a 30-day month -- nothing to compare this cycle.

      const daysUntilDue = calendarDaysBetween(now, dueDate);
      if (daysUntilDue > DUE_SOON_WITHIN_DAYS || daysUntilDue < -DUE_SOON_WITHIN_DAYS) continue;

      if (!best || daysUntilDue < best.daysUntilDue) {
        best = { name: expense.name, amount: expense.targetAmount - expense.actual, daysUntilDue };
      }
    }
  }

  if (!best) return null;
  const dueText =
    best.daysUntilDue === 0
      ? "due today"
      : best.daysUntilDue === 1
        ? "due tomorrow"
        : best.daysUntilDue > 1
          ? `due in ${best.daysUntilDue} days`
          : best.daysUntilDue === -1
            ? "was due yesterday"
            : `was due ${Math.abs(best.daysUntilDue)} days ago`;

  return {
    text: `${best.name} (${formatCurrency(best.amount)}) ${dueText} and isn't marked paid.`,
    priority: PRIORITY.DUE_SOON,
    href: "/budget",
  };
}

/**
 * Counts this cycle's recurring expenses still "not-started" or "partial"
 * (see lib/recurring-expense-status.ts) and sums what's left to pay on
 * each (target minus actual, floored at 0 -- a recurring expense already
 * paid past its target contributes nothing here). The highest-value gap
 * this rework closes: Insights previously had no idea Recurring Expenses
 * existed at all.
 */
function unpaidRecurringCandidate(categories: CategoryWithRecurringExpenses[]): Candidate | null {
  let count = 0;
  let remaining = 0;
  for (const category of categories) {
    for (const expense of category.expenses) {
      const status = getRecurringExpensePaymentStatus(expense.actual, expense.targetAmount);
      if (status === "not-started" || status === "partial") {
        count++;
        remaining += Math.max(expense.targetAmount - expense.actual, 0);
      }
    }
  }
  if (count === 0) return null;

  const noun = count === 1 ? "recurring expense hasn't" : "recurring expenses haven't";
  return {
    text: `${count} ${noun} been paid yet this cycle (${formatCurrency(remaining)} left).`,
    priority: PRIORITY.UNPAID_RECURRING,
    href: "/budget",
  };
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
): Candidate | null {
  if (previousClosedFinancials.length < ANOMALY_MIN_HISTORY) {
    return categoryDeltaFallback(current, previousClosedFinancials);
  }

  const window = previousClosedFinancials.slice(0, ANOMALY_WINDOW_SIZE);
  let best: { categoryId: string; categoryName: string; amount: number; average: number; relativeDelta: number } | null = null;

  for (const category of current.categoryTotals) {
    const sum = window.reduce((total, cycle) => {
      const match = cycle.categoryTotals.find((c) => c.categoryId === category.categoryId);
      return total + (match?.amount ?? 0);
    }, 0);
    const average = sum / window.length;
    if (average <= 0) continue; // No baseline to compare against -- a brand-new category isn't an "anomaly."

    const relativeDelta = (category.amount - average) / average;
    // Only an increase is actionable -- a category quietly spending LESS
    // than usual isn't something a user needs to be told to look into.
    if (relativeDelta < ANOMALY_THRESHOLD_FRACTION) continue;
    if (!best || relativeDelta > best.relativeDelta) {
      best = { categoryId: category.categoryId, categoryName: category.categoryName, amount: category.amount, average, relativeDelta };
    }
  }

  if (!best) return null;
  return {
    text: `${best.categoryName} spending is up ${formatCurrency(best.amount - best.average)} vs your recent average.`,
    priority: PRIORITY.CATEGORY_ANOMALY,
    href: `/transactions?category=${best.categoryId}`,
  };
}

/** The original single-previous-cycle comparison -- kept as the under-2-closed-cycles fallback for categoryAnomalyCandidate. */
function categoryDeltaFallback(
  current: CycleFinancials,
  previousClosedFinancials: CycleFinancials[],
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
    text: `${topCategory.categoryName} spending is up ${formatCurrency(delta)} vs last cycle.`,
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
function paceAwareCandidate(
  current: CycleFinancials,
  cycle: { periodStart: Date; periodEnd: Date | null },
  now: Date,
): Candidate {
  if (current.amountLeft < 0) {
    return {
      text: `You're ${formatCurrency(Math.abs(current.amountLeft))} over budget this cycle so far.`,
      priority: PRIORITY.OVER_BUDGET,
    };
  }

  const cycleEnd = cycle.periodEnd ?? quincenaEnd(cycle.periodStart);
  const totalDays = calendarDaysBetween(cycle.periodStart, cycleEnd) + 1;
  const elapsedDays = Math.min(Math.max(calendarDaysBetween(cycle.periodStart, now) + 1, 1), totalDays);
  const daysRemaining = Math.max(totalDays - elapsedDays, 0);

  const dailyRate = current.totalExpenses / elapsedDays;
  if (dailyRate > 0) {
    const daysUntilExhausted = current.amountLeft / dailyRate;
    if (daysUntilExhausted < daysRemaining) {
      const runOutDate = addDays(now, Math.floor(daysUntilExhausted));
      const daysBeforePayday = daysRemaining - Math.floor(daysUntilExhausted);
      return {
        text: `At your current pace you'll run out of cash around ${formatFriendlyDate(runOutDate)} — ${daysBeforePayday} day${daysBeforePayday === 1 ? "" : "s"} before your next payday.`,
        priority: PRIORITY.PACE_WARNING,
      };
    }
  }

  return {
    text: "You're spending at a sustainable pace to make it to your next payday.",
    priority: PRIORITY.ON_TRACK,
  };
}

/** Unchanged from before this rework -- counts consecutive (newest-first) closed cycles finishing with amountLeft >= 0, stopping at the first that didn't. Only shown for a streak of 2+. */
function streakCandidate(previousClosedFinancials: CycleFinancials[]): Candidate | null {
  if (previousClosedFinancials.length === 0) return null;

  let streak = 0;
  for (const cycle of previousClosedFinancials) {
    if (cycle.amountLeft < 0) break;
    streak++;
  }
  if (streak < 2) return null;

  return {
    text: `You've stayed under budget for ${streak} cycles in a row.`,
    priority: PRIORITY.STREAK,
  };
}

/**
 * Surfaces whichever active savings goal is closest to its lifetime
 * target (within SAVINGS_GOAL_PROXIMITY_THRESHOLD_PERCENT%), skipping
 * anything already complete or still far off -- announcing "you're 90%
 * short" as if it were exciting news isn't the point of this rule.
 */
function savingsGoalCandidate(goals: GoalWithProgress[], now: Date): Candidate | null {
  let best: { name: string; remaining: number; percentage: number } | null = null;

  for (const goal of goals) {
    const projection = computeGoalProjection({
      savedSoFar: goal.savedSoFar,
      lifetimeTargetAmount: goal.lifetimeTargetAmount,
      currentCycleRecurringAmount: goal.currentCycleRecurringAmount,
      now,
    });
    if (projection.isComplete) continue;
    if (projection.percentage < SAVINGS_GOAL_PROXIMITY_THRESHOLD_PERCENT) continue;
    if (!best || projection.percentage > best.percentage) {
      best = { name: goal.name, remaining: projection.remaining, percentage: projection.percentage };
    }
  }

  if (!best) return null;
  return {
    text: `You're ${formatCurrency(best.remaining)} away from hitting your ${best.name} target.`,
    priority: PRIORITY.SAVINGS_GOAL,
    href: "/goals",
  };
}
