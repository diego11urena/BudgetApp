import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRequestLocale } from "@/lib/i18n/locale";
import { prisma } from "@/lib/prisma";
import {
  getAdjacentClosedCycles,
  getClosedCycles,
  getOrCreateDraftCycle,
  getUserBudgetFrequency,
} from "@/lib/cycles";
import { getCycleFinancials, summarizeCycleFinancials } from "@/lib/cycle-financials";
import {
  computeBiggestTransactions,
  computeCashFlowBreakdown,
  computeCategoryRollingAverage,
  computeDailySpendBuckets,
  computeWeekendShare,
  computeHeatmapPercentileBuckets,
  computeLiveBanner,
  computeSameDayIndexAverage,
  computeTransactionsForDay,
  pickDefaultSelectedDay,
} from "@/lib/breakdown-v2";
import { getRecurringExpensesForCycle } from "@/lib/recurring-expenses";
import { summarizeRecurringFulfillment } from "@/lib/recurring-fulfillment";
import { calendarDaysBetween, cycleEnd as resolveCycleEnd } from "@/lib/quincena-pace";
import { formatCycleLabel } from "@/lib/pay-date";
import { formatCycleRangeLabel } from "@/lib/format";
import BreakdownScreenNew from "./_components/BreakdownScreenNew";
import type { DayTransaction } from "./_components/types";

export const metadata: Metadata = { title: "Breakdown" };

/** How many closed periods chapter 03's "Usual: $X" line and the CLOSED banner's comparison average look back over. */
const HISTORY_DEPTH = 6;

/**
 * Two states off one route, exactly as the design handoff specifies:
 * no `?cycle=` -> LIVE (the still-open draft cycle, with mid-cycle pacing),
 * `?cycle={id}` -> CLOSED (that historical cycle, with prev/next chevrons).
 *
 * Everything handed to BreakdownScreenNew below is a plain string/number --
 * never the Dictionary itself. Its templated strings are real functions
 * (`sublineDay: (day, total) => string`), and React can only serialize a
 * function across the server/client boundary when it's a "use server"
 * action, so passing `t` to a "use client" component throws at render time
 * and trips the error boundary. The client side reads the dictionary from
 * LocaleProvider's useT()/useVocab() instead -- see that file's own doc
 * comment, which spells out this exact rule.
 */
export default async function BreakdownPage({
  searchParams,
}: {
  searchParams: Promise<{ cycle?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  // Dates on this screen go through the formatters, which need the locale
  // to render month names in the user's own language.
  const locale = await getRequestLocale();
  const { cycle: cycleIdParam } = await searchParams;

  // Ownership and status are both enforced in the query itself -- a cycle
  // belonging to someone else, or one still open, is a 404 here rather
  // than a screen rendered against a cycle this user can't see.
  const cycle = cycleIdParam
    ? await prisma.budgetCycle.findFirst({ where: { id: cycleIdParam, userId, status: "CLOSED" } })
    : await getOrCreateDraftCycle(userId);
  if (!cycle) {
    notFound();
  }
  const state: "LIVE" | "CLOSED" = cycleIdParam ? "CLOSED" : "LIVE";

  const [budgetFrequency, financials, closedCycles, recurringExpenseCategories] = await Promise.all([
    getUserBudgetFrequency(userId),
    getCycleFinancials(cycle.id),
    getClosedCycles(userId, HISTORY_DEPTH),
    // computeSuggestions: false -- Breakdown only reads status/hasFixedDate/dueDay
    // (see summarizeRecurringFulfillment), never the match-suggestion machinery
    // Plan's own picker UI needs.
    getRecurringExpensesForCycle(userId, cycle.id, { computeSuggestions: false }),
  ]);

  // A closed cycle has a real periodEnd; an open one is still calendar-derived
  // (same fallback computeCyclePace itself uses).
  const periodEnd = cycle.periodEnd ?? resolveCycleEnd(cycle.periodStart, budgetFrequency);
  const totalDays = calendarDaysBetween(cycle.periodStart, periodEnd) + 1;
  // A closed cycle is always "day totalDays of totalDays"; a live one is
  // clamped into range so an overdue cycle (past its calendar end, not yet
  // closed) reads "day 15 of 15" rather than "day 19 of 15".
  const dayIndex =
    state === "LIVE"
      ? Math.min(Math.max(calendarDaysBetween(cycle.periodStart, new Date()) + 1, 1), totalDays)
      : totalDays;

  const banner = computeLiveBanner(financials.totalExpenses, dayIndex, totalDays);

  // ---- Chapter 04: when you spend -------------------------------------
  const dailyTotals = computeDailySpendBuckets(financials.transactions, cycle.periodStart, periodEnd);
  const buckets = computeHeatmapPercentileBuckets(dailyTotals);
  const todayLabel = formatCycleLabel(new Date());
  const heatmapDays = dailyTotals.map((day) => {
    const label = formatCycleLabel(day.date);
    return {
      date: label,
      bucket: buckets.get(label) ?? (0 as const),
      total: day.total,
      // A live cycle's future days aren't "no spending", they haven't
      // happened -- greyed out rather than rendered as a real zero.
      disabled: state === "LIVE" && label > todayLabel,
    };
  });
  const defaultSelected = pickDefaultSelectedDay(dailyTotals, state, new Date());
  // Chapter 04's takeaway. Rounded here rather than in the component so
  // the copy function only ever receives a whole percentage to print.
  const weekendShare = computeWeekendShare(dailyTotals);
  const weekendSharePercent = weekendShare === null ? null : Math.round(weekendShare.share * 100);
  const selectedDayDefault = defaultSelected ? formatCycleLabel(defaultSelected) : null;
  // Only the days that actually have something to show, so a 31-day cycle
  // doesn't ship 31 empty arrays to the client.
  const transactionsByDay: Record<string, DayTransaction[]> = {};
  for (const day of dailyTotals) {
    if (day.total === 0) continue;
    const label = formatCycleLabel(day.date);
    transactionsByDay[label] = computeTransactionsForDay(financials.transactions, day.date)
      .filter((tx) => tx.type === "EXPENSE")
      .map((tx) => ({
        id: tx.id,
        name: tx.name,
        amount: tx.amount,
        categoryName: tx.categoryName,
        isRecurring: tx.recurringExpenseId !== null,
      }));
  }

  // ---- Chapter 05: biggest transactions --------------------------------
  // Excludes whichever day chapter 04 just defaulted to, so the two
  // chapters never repeat the same purchase (see pickDefaultSelectedDay's
  // own doc comment).
  const biggestTransactions = computeBiggestTransactions(financials.transactions, {
    excludeDate: selectedDayDefault,
    limit: 5,
  });

  // ---- Chapter 01: cash flow -------------------------------------------
  const cashFlow = computeCashFlowBreakdown(financials);

  // ---- Chapter 02: recurring --------------------------------------------
  const recurringFulfillment = summarizeRecurringFulfillment(recurringExpenseCategories, new Date());

  // ---- Trailing history (chapter 03's "usual" + CLOSED's comparison average) ----
  // Oldest first, ending on the cycle being viewed, so every series reads
  // left-to-right through time. The viewed cycle is excluded from the
  // history half so it can't appear twice.
  const history = closedCycles
    .filter((c) => c.id !== cycle.id)
    .map((c) => ({
      financials: summarizeCycleFinancials(c.incomeEntries, c.transactions),
      periodStart: c.periodStart,
    }));

  // ---- Chapter 03: by category ------------------------------------------
  // Rolling average wants most-recent-first; a category with no prior-period
  // data gets null rather than a misleading 0 usual.
  const categories = financials.categoryTotals.slice(0, 8).map((ct) => {
    const rolling = history.length > 0 ? computeCategoryRollingAverage(ct.categoryId, history, HISTORY_DEPTH) : 0;
    return {
      categoryId: ct.categoryId,
      categoryName: ct.categoryName,
      categoryIcon: ct.categoryIcon,
      amount: ct.amount,
      usualAmount: history.length > 0 && rolling > 0 ? rolling : null,
    };
  });

  // ---- CLOSED-state comparison ----------------------------------------
  let prevCycleId: string | null = null;
  let nextCycleId: string | null = null;
  let comparisonAverage = 0;
  if (state === "CLOSED") {
    const adjacent = await getAdjacentClosedCycles(userId, cycle);
    prevCycleId = adjacent.previous?.id ?? null;
    nextCycleId = adjacent.next?.id ?? null;
    comparisonAverage = computeSameDayIndexAverage(history, totalDays);
  }

  const dateRangeLabel = formatCycleRangeLabel(cycle.periodStart, periodEnd, locale);

  return (
    <BreakdownScreenNew
      state={state}
      dateRangeLabel={dateRangeLabel}
      spent={banner.spent}
      projected={banner.projected ?? 0}
      dayIndex={dayIndex}
      totalDays={totalDays}
      comparisonAverage={comparisonAverage}
      comparisonCycleCount={history.length}
      prevCycleId={prevCycleId}
      nextCycleId={nextCycleId}
      heatmapDays={heatmapDays}
      selectedDayDefault={selectedDayDefault}
      transactionsByDay={transactionsByDay}
      cashFlow={cashFlow}
      recurringFulfillment={recurringFulfillment}
      biggestTransactions={biggestTransactions}
      categories={categories}
      historyCount={history.length}
      weekendSharePercent={weekendSharePercent}
      income={cashFlow.income}
    />
  );
}
