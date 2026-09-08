import type { CycleFinancials, CycleTransactionSummary } from "./cycle-financials";

/** Transaction classification for chapters 02 and 03. */
export type TransactionCategory = "fixed" | "discretionary" | "goals";

/** A day's spend total for heatmap rendering. */
export interface DailySpend {
  date: Date;
  total: number;
}

/** Heatmap bucket (0-4, where 0 = no spend, 1-4 = percentile buckets). */
export type HeatmapBucket = 0 | 1 | 2 | 3 | 4;

/** Trend series point (a period's Bills/Discretionary split). */
export interface TrendPoint {
  label: string;
  bills: number;
  discretionary: number;
}

/** Fixed-share trend direction. */
export type FixedShareDirection = "rising" | "falling" | "holding steady";

/** Fixed-share trend result. */
export interface FixedShareTrend {
  periods: { billsPct: number; discretionaryPct: number; goalsPct: number }[];
  direction: FixedShareDirection;
  oldPct: number;
  newPct: number;
}

/** Live/CLOSED banner data. */
export interface BannerData {
  spent: number;
  projected?: number; // LIVE only
  dayIndex?: number; // LIVE only
  totalDays?: number; // LIVE only
  avg?: number; // CLOSED only
}

/**
 * Classify a transaction as fixed, discretionary, or goals.
 * The ONE place this rule lives — all chapter 02/03 aggregators call through it.
 *
 * Rule: SAVINGS → goals; EXPENSE + recurringExpenseId != null → fixed; else discretionary.
 */
export function classifyTransaction(tx: CycleTransactionSummary): TransactionCategory {
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
    const day = tx.occurredAt.toISOString().split("T")[0];
    dayTotals.set(day, (dayTotals.get(day) ?? 0) + tx.amount);
  }

  // Fill in all days in range, even zero-spend days.
  const result: DailySpend[] = [];
  let current = new Date(periodStart);
  while (current <= periodEnd) {
    const day = current.toISOString().split("T")[0];
    result.push({
      date: new Date(current),
      total: dayTotals.get(day) ?? 0,
    });
    current.setDate(current.getDate() + 1);
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
      result.set(day.date.toISOString().split("T")[0], 0);
    }
    return result;
  }

  // Compute percentiles.
  const p25 = nonZeroAmounts[Math.floor(nonZeroAmounts.length * 0.25)];
  const p50 = nonZeroAmounts[Math.floor(nonZeroAmounts.length * 0.5)];
  const p75 = nonZeroAmounts[Math.floor(nonZeroAmounts.length * 0.75)];

  for (const day of dailyTotals) {
    if (day.total === 0) {
      result.set(day.date.toISOString().split("T")[0], 0);
    } else if (day.total <= p25) {
      result.set(day.date.toISOString().split("T")[0], 1);
    } else if (day.total <= p50) {
      result.set(day.date.toISOString().split("T")[0], 2);
    } else if (day.total <= p75) {
      result.set(day.date.toISOString().split("T")[0], 3);
    } else {
      result.set(day.date.toISOString().split("T")[0], 4);
    }
  }

  return result;
}

/**
 * Pick the default selected day for the heatmap:
 * highest-spend day (ties broken by most recent); null if all zero.
 */
export function pickDefaultSelectedDay(dailyTotals: DailySpend[]): Date | null {
  if (dailyTotals.length === 0) return null;

  let maxDay: DailySpend | null = null;
  for (const day of dailyTotals) {
    if (day.total > 0 && (!maxDay || day.total > maxDay.total)) {
      maxDay = day;
    }
  }

  return maxDay?.date ?? null;
}

/**
 * Filter transactions to a specific calendar day.
 */
export function computeTransactionsForDay(transactions: CycleTransactionSummary[], date: Date): CycleTransactionSummary[] {
  const dayStr = date.toISOString().split("T")[0];
  return transactions.filter((tx) => tx.occurredAt.toISOString().split("T")[0] === dayStr);
}

/**
 * Trend series: last 5-6 periods + "Now" (current, possibly-partial cycle),
 * splitting each by fixed vs discretionary via classifyTransaction.
 */
export function computeTrendSeries(
  cycles: { financials: CycleFinancials; periodLabel?: string }[]
): TrendPoint[] {
  return cycles.map((cycle) => {
    let bills = 0;
    let discretionary = 0;

    for (const tx of cycle.financials.transactions) {
      const classification = classifyTransaction(tx);
      if (classification === "fixed") {
        bills += tx.amount;
      } else if (classification === "discretionary") {
        discretionary += tx.amount;
      }
      // Goals don't contribute to bills or discretionary.
    }

    return {
      label: cycle.periodLabel ?? "",
      bills,
      discretionary,
    };
  });
}

/**
 * Fixed-share trend: last 6 periods' bills/discretionary/goals % of total spend.
 * Direction = rising/falling if delta > 1.5pt, else holding steady.
 */
export function computeFixedShareTrend(
  cycles: { financials: CycleFinancials }[]
): FixedShareTrend {
  const periods: { billsPct: number; discretionaryPct: number; goalsPct: number }[] = [];

  for (const cycle of cycles) {
    let bills = 0;
    let discretionary = 0;
    let goals = 0;

    for (const tx of cycle.financials.transactions) {
      const classification = classifyTransaction(tx);
      if (classification === "fixed") {
        bills += tx.amount;
      } else if (classification === "discretionary") {
        discretionary += tx.amount;
      } else {
        goals += tx.amount;
      }
    }

    const total = bills + discretionary + goals;
    if (total === 0) {
      periods.push({ billsPct: 0, discretionaryPct: 0, goalsPct: 0 });
    } else {
      periods.push({
        billsPct: (bills / total) * 100,
        discretionaryPct: (discretionary / total) * 100,
        goalsPct: (goals / total) * 100,
      });
    }
  }

  let direction: FixedShareDirection = "holding steady";
  let oldPct = 0;
  let newPct = 0;

  if (periods.length >= 2) {
    oldPct = periods[0].billsPct;
    newPct = periods[periods.length - 1].billsPct;
    const delta = newPct - oldPct;
    if (delta > 1.5) {
      direction = "rising";
    } else if (delta < -1.5) {
      direction = "falling";
    }
  }

  return { periods, direction, oldPct, newPct };
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
 * Category rolling average: trailing-N average of a category's total spend.
 */
export function computeCategoryRollingAverage(
  categoryId: string,
  cycles: { financials: CycleFinancials }[],
  trailingN: number = 4
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
