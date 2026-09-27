import type { CycleFinancials, CycleTransactionSummary } from "./cycle-financials";
import { addDays, formatCycleLabel } from "./pay-date";

/** Transaction classification for the cash-flow model and its consumers. */
export type TransactionCategory = "fixed" | "discretionary" | "goals" | "income";

/** A day's spend total for heatmap rendering. */
export interface DailySpend {
  date: Date;
  total: number;
}

/** Heatmap bucket (0-4, where 0 = no spend, 1-4 = percentile buckets). */
export type HeatmapBucket = 0 | 1 | 2 | 3 | 4;

/** Live/CLOSED banner data. */
export interface BannerData {
  spent: number;
  projected?: number; // LIVE only
  dayIndex?: number; // LIVE only
  totalDays?: number; // LIVE only
  avg?: number; // CLOSED only
}

/**
 * Classify a transaction for the cash-flow model. The ONE place this rule
 * lives — every aggregator that needs fixed/discretionary/goals/income
 * calls through it, instead of each re-deriving its own version.
 *
 * Rule: INCOME → income; SAVINGS → goals; EXPENSE + recurringExpenseId
 * != null → fixed; every other EXPENSE → discretionary. INCOME used to
 * fall through to "discretionary" here (a fallback convenient for this
 * function's original two callers, both of which pre-filtered to EXPENSE
 * transactions before ever calling this) -- computeCashFlowBreakdown and
 * computeBiggestTransactions don't pre-filter, so that fallback silently
 * counted extra income as spending (see git history for the bug report:
 * "Biggest transactions" showing an income row). Explicit "income" now,
 * so a caller that forgets to exclude it gets a visibly wrong bucket to
 * debug instead of a plausible-looking wrong number.
 */
export function classifyTransaction(tx: CycleTransactionSummary): TransactionCategory {
  if (tx.type === "INCOME") return "income";
  if (tx.type === "SAVINGS") return "goals";
  if (tx.type === "EXPENSE" && tx.recurringExpenseId) return "fixed";
  return "discretionary";
}

/**
 * Daily spend buckets: one entry per calendar day in the cycle,
 * summing only EXPENSE transactions (discretionary + fixed both count).
 * Sorted by date, oldest first.
 */
export function computeDailySpendBuckets(
  transactions: CycleTransactionSummary[],
  periodStart: Date,
  periodEnd: Date
): DailySpend[] {
  const dayTotals = new Map<string, number>();

  for (const tx of transactions) {
    if (tx.type !== "EXPENSE") continue;
    const day = formatCycleLabel(tx.occurredAt);
    dayTotals.set(day, (dayTotals.get(day) ?? 0) + tx.amount);
  }

  // Fill in all days in range, even zero-spend days. Both the walk and the
  // keys go through pay-date's Panama helpers, never toISOString()/setDate():
  // this app's calendar day is America/Panama (UTC-5), so a 7pm purchase is
  // already tomorrow in UTC and would land on the wrong heatmap cell -- the
  // one thing this chapter exists to get right. See pay-date.ts's own
  // addDays comment for why setDate() is wrong for the same reason.
  const result: DailySpend[] = [];
  const endLabel = formatCycleLabel(periodEnd);
  let current = periodStart;
  // Bounded rather than `while (current <= periodEnd)`: a cycle whose end
  // somehow precedes its start would otherwise spin forever.
  for (let i = 0; i < 400; i++) {
    const day = formatCycleLabel(current);
    result.push({ date: current, total: dayTotals.get(day) ?? 0 });
    if (day >= endLabel) break;
    current = addDays(current, 1);
  }

  return result;
}

/**
 * Heatmap percentile buckets: assigns each day to bucket 0-4.
 * Bucket 0 = no spend; 1-4 = 25th/50th/75th percentile splits of non-zero days.
 */
export function computeHeatmapPercentileBuckets(dailyTotals: DailySpend[]): Map<string, HeatmapBucket> {
  const result = new Map<string, HeatmapBucket>();

  // Extract non-zero amounts.
  const nonZeroAmounts = dailyTotals.filter((d) => d.total > 0).map((d) => d.total).sort((a, b) => a - b);

  if (nonZeroAmounts.length === 0) {
    // All zero days → everyone gets bucket 0.
    for (const day of dailyTotals) {
      result.set(formatCycleLabel(day.date), 0);
    }
    return result;
  }

  // Compute percentiles.
  const p25 = nonZeroAmounts[Math.floor(nonZeroAmounts.length * 0.25)];
  const p50 = nonZeroAmounts[Math.floor(nonZeroAmounts.length * 0.5)];
  const p75 = nonZeroAmounts[Math.floor(nonZeroAmounts.length * 0.75)];

  for (const day of dailyTotals) {
    const key = formatCycleLabel(day.date);
    if (day.total === 0) {
      result.set(key, 0);
    } else if (day.total <= p25) {
      result.set(key, 1);
    } else if (day.total <= p50) {
      result.set(key, 2);
    } else if (day.total <= p75) {
      result.set(key, 3);
    } else {
      result.set(key, 4);
    }
  }

  return result;
}

/**
 * Pick the default selected day for the heatmap and, downstream, the day
 * computeBiggestTransactions excludes so chapters 04 and 05 never repeat
 * the same purchase. CLOSED: the most recent day with any spend (not the
 * highest-spend day -- that was this function's old rule, but "most
 * recent" is what the design spec calls for and what a closed period's
 * default panel should show). LIVE: always today, even if today is $0 --
 * a day-in-progress panel showing yesterday's spend instead would be
 * confusing mid-cycle. Null only when the whole period is zero (CLOSED)
 * or today somehow isn't in dailyTotals at all (shouldn't happen --
 * computeDailySpendBuckets always fills every day in range).
 */
export function pickDefaultSelectedDay(dailyTotals: DailySpend[], state: "LIVE" | "CLOSED", now: Date): Date | null {
  if (dailyTotals.length === 0) return null;

  if (state === "LIVE") {
    const todayLabel = formatCycleLabel(now);
    return dailyTotals.find((day) => formatCycleLabel(day.date) === todayLabel)?.date ?? null;
  }

  for (let i = dailyTotals.length - 1; i >= 0; i--) {
    if (dailyTotals[i].total > 0) return dailyTotals[i].date;
  }
  return null;
}

/**
 * Filter transactions to a specific calendar day.
 */
export function computeTransactionsForDay(transactions: CycleTransactionSummary[], date: Date): CycleTransactionSummary[] {
  const dayStr = formatCycleLabel(date);
  return transactions.filter((tx) => formatCycleLabel(tx.occurredAt) === dayStr);
}

/**
 * Same-day-index average: trailing-N average cumulative spend through dayIndex days
 * across closed cycles. Used for CLOSED banner's comparison.
 */
export function computeSameDayIndexAverage(
  closedCyclesFinancials: { financials: CycleFinancials; periodStart: Date }[],
  dayIndex: number,
  trailingN: number = 4
): number {
  if (closedCyclesFinancials.length === 0) return 0;

  // Take the last trailingN cycles (most recent first).
  const recent = closedCyclesFinancials.slice(0, trailingN);
  if (recent.length === 0) return 0;

  let total = 0;
  for (const cycle of recent) {
    let cumulative = 0;
    let daysConsidered = 0;

    for (const tx of cycle.financials.transactions) {
      if (tx.type !== "EXPENSE") continue;

      // Count days from periodStart.
      const daysDiff = Math.floor(
        (tx.occurredAt.getTime() - cycle.periodStart.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff <= dayIndex) {
        cumulative += tx.amount;
        daysConsidered = Math.max(daysConsidered, daysDiff + 1);
      }
    }

    total += cumulative;
  }

  return Math.round((total / recent.length) * 100) / 100;
}

/**
 * Category rolling average ("Usual: $X" on chapter 03's By-category rows):
 * trailing-N average of a category's total spend. Default 6, not 4 --
 * matches HISTORY_DEPTH, the same "last 6 closed periods" window every
 * other history-dependent figure on this page uses (the sparkline,
 * chapter 03's own "vs your usual" framing). Callers should still pass
 * their own history-depth constant explicitly rather than rely on this
 * default, so the two stay obviously in sync at the call site.
 */
export function computeCategoryRollingAverage(
  categoryId: string,
  cycles: { financials: CycleFinancials }[],
  trailingN: number = 6
): number {
  if (cycles.length === 0) return 0;

  const recent = cycles.slice(0, trailingN);
  let total = 0;

  for (const cycle of recent) {
    const categoryTotal = cycle.financials.categoryTotals.find((ct) => ct.categoryId === categoryId);
    if (categoryTotal) {
      total += categoryTotal.amount;
    }
  }

  return Math.round((total / recent.length) * 100) / 100;
}

/**
 * Live banner data: thin wrapper computing projected spend from pace data.
 * Projection = spent / dayIndex * totalDays.
 */
export function computeLiveBanner(
  spent: number,
  dayIndex: number,
  totalDays: number
): BannerData {
  const projected = dayIndex > 0 ? Math.round((spent / dayIndex) * totalDays * 100) / 100 : 0;
  return { spent, projected, dayIndex, totalDays };
}

/** Chapter 01's cash-flow split: income = fixed + everythingElse + saved + leftover. */
export interface CashFlowBreakdown {
  income: number;
  fixed: number;
  everythingElse: number;
  saved: number;
  /** Distinct SAVINGS-category names touched this period, first-seen order -- feeds the tappable Saved row's subline ("Emergency Fund · Japan trip"). */
  savedGoals: string[];
  /**
   * income - fixed - everythingElse - saved, clamped to >= 0. When the
   * period is overspent (fixed+everythingElse+saved > income) the four
   * parts no longer sum back to income -- that's the clamp working as
   * spec'd ("Leftover clamped >= 0"), not a bug: there's nothing left to
   * call "leftover," and the alternative (a negative Leftover) would be
   * a stranger number to show than the shortfall just not appearing here.
   */
  leftover: number;
}

/**
 * Computes chapter 01's Cash-flow split for one cycle. Reuses
 * classifyTransaction (the same fixed/discretionary/goals rule chapters
 * 02/03 and computeBiggestTransactions below all share) rather than
 * introducing a second classification path.
 */
export function computeCashFlowBreakdown(financials: CycleFinancials): CashFlowBreakdown {
  const income = financials.baseIncome + financials.extraIncome;
  let fixed = 0;
  let everythingElse = 0;
  const savedGoals: string[] = [];
  const seenGoals = new Set<string>();

  for (const tx of financials.transactions) {
    const classification = classifyTransaction(tx);
    if (classification === "fixed") {
      fixed += tx.amount;
    } else if (classification === "discretionary") {
      everythingElse += tx.amount;
    } else if (classification === "goals" && tx.categoryName && !seenGoals.has(tx.categoryName)) {
      seenGoals.add(tx.categoryName);
      savedGoals.push(tx.categoryName);
    }
    // "income" isn't spending or saving -- already counted in `income` above (financials.baseIncome + extraIncome).
  }

  const saved = financials.totalSavings;
  const leftover = Math.max(0, income - fixed - everythingElse - saved);

  return { income, fixed, everythingElse, saved, savedGoals, leftover };
}

/** One row in chapter 05's "Biggest transactions" list. */
export interface BiggestTransactionRow {
  id: string;
  name: string;
  categoryName: string | null;
  amount: number;
  occurredAt: Date;
}

/**
 * Top-N discretionary transactions by amount ("the single purchases that
 * stood out"). classifyTransaction === "discretionary" excludes fixed
 * (recurring-linked) items, goal transfers, AND income in the same pass --
 * the spec only asks for the first two, but a purchase list showing a
 * paycheck as its "biggest transaction" would be its own kind of wrong
 * (see classifyTransaction's own doc comment for the bug this used to be
 * before "income" became its own classification). excludeDate
 * (formatCycleLabel-style "YYYY-MM-DD", typically chapter 04's own
 * default-selected day) keeps this chapter from repeating a purchase
 * chapter 04's day panel already shows.
 */
export function computeBiggestTransactions(
  transactions: CycleTransactionSummary[],
  options: { excludeDate?: string | null; limit?: number } = {}
): BiggestTransactionRow[] {
  const { excludeDate = null, limit = 5 } = options;

  return transactions
    .filter((tx) => classifyTransaction(tx) === "discretionary")
    .filter((tx) => excludeDate === null || formatCycleLabel(tx.occurredAt) !== excludeDate)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
    .map((tx) => ({ id: tx.id, name: tx.name, categoryName: tx.categoryName, amount: tx.amount, occurredAt: tx.occurredAt }));
}
