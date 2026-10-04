import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCycleFinancials, summarizeCycleFinancials } from "@/lib/cycle-financials";
import { getClosedCycles, getUserBudgetFrequency, formatCycleRangeText } from "@/lib/cycles";
import { getRecurringExpensesForCycle } from "@/lib/recurring-expenses";
import { summarizeRecurringFulfillment } from "@/lib/recurring-fulfillment";
import { getGoalsWithProgress } from "@/lib/goals";
import { computeSpendComparison, computeUncategorizedWarning } from "@/lib/summary";
import SummaryScreen from "../_components/SummaryScreen";

export const metadata: Metadata = { title: "Summary" };

/**
 * How many closed cycles to fetch for the sparkline (6) and the "your
 * lightest/heaviest since {month}" context line (12, a wider window --
 * the sparkline is meant to be a compact recent-trend glance, while the
 * "since when" superlative reads oddly if it can only ever look back
 * half a year).
 */
const SPARKLINE_DEPTH = 6;
const COMPARISON_HISTORY_DEPTH = 12;

/**
 * The end-of-cycle Summary, reached after closing a cycle and from
 * History's cycle detail. Closed cycles only -- a still-open one has no
 * "here's how it went" story to tell yet.
 *
 * Like the Breakdown page, nothing here hands the Dictionary itself to the
 * client tree: SummaryScreen is "use client" and reads it from
 * LocaleProvider instead (see that file's doc comment -- templated strings
 * are functions, which React can't serialize across the boundary).
 */
export default async function SummaryPage({ params }: { params: Promise<{ cycleId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const { cycleId } = await params;

  // Ownership + CLOSED status enforced in the query itself.
  const cycle = await prisma.budgetCycle.findFirst({
    where: { id: cycleId, userId, status: "CLOSED" },
  });
  if (!cycle) {
    notFound();
  }

  const [budgetFrequency, financials, goalsWithProgress, recurringExpenseCategories, closedCycles, nextCycle] =
    await Promise.all([
      getUserBudgetFrequency(userId),
      getCycleFinancials(cycle.id),
      getGoalsWithProgress(userId, cycle.id),
      getRecurringExpensesForCycle(userId, cycle.id, { computeSuggestions: false }),
      getClosedCycles(userId, COMPARISON_HISTORY_DEPTH),
      // The period this summary hands off to, so the CTA can name its
      // actual dates ("Start Sep 1 - Sep 15") rather than the generic
      // "Start next paycheck". findFirst, deliberately NOT
      // getOrCreateDraftCycle: viewing a past summary must never create a
      // cycle as a side effect. Null is a normal outcome (an old summary
      // reached from History, where the open cycle may be several periods
      // on), and the CTA falls back to the generic label then.
      prisma.budgetCycle.findFirst({
        where: { userId, status: { in: ["DRAFT", "ACTIVE"] } },
        select: { periodStart: true, periodEnd: true },
      }),
    ]);

  // Shared with Breakdown's chapter 02 -- see lib/recurring-fulfillment.ts's
  // own doc comment for why the two screens read from one function.
  // Judged from the cycle's own end, not today: this screen only ever
  // shows a CLOSED cycle, and nothing can still arrive in a period that
  // has already ended (see summarizeRecurringFulfillment's own note on
  // asOf). periodEnd is always set on a closed cycle; the fallback is
  // only there so a malformed row can't crash the page.
  const recurringFulfillment = summarizeRecurringFulfillment(
    recurringExpenseCategories,
    cycle.periodEnd ?? new Date(),
  );

  // Newest-first (getClosedCycles' own order) -- exactly what
  // computeSpendComparison wants for recentSpends (trailing N prior
  // periods, most recent first).
  const closedFinancials = closedCycles.map((c) => ({
    financials: summarizeCycleFinancials(c.incomeEntries, c.transactions),
    periodStart: c.periodStart,
  }));
  const comparison = computeSpendComparison(
    financials.totalExpenses,
    closedFinancials.slice(0, 3).map((c) => c.financials.totalExpenses),
    closedFinancials.map((c) => ({ amount: c.financials.totalExpenses, periodStart: c.periodStart })),
  );

  // Oldest-first, so the sparkline reads left-to-right through time and
  // ends on this cycle. Whatever history exists is what gets drawn -- a
  // brand-new account with one closed cycle gets a single dot, not a
  // fabricated trend. Only the most recent SPARKLINE_DEPTH of the wider
  // comparison-history fetch -- the sparkline itself stays a compact
  // recent-trend glance, not the full COMPARISON_HISTORY_DEPTH window.
  const sparklinePoints = closedFinancials
    .slice(0, SPARKLINE_DEPTH)
    .reverse()
    .map((c) => c.financials.totalExpenses);

  return (
    <SummaryScreen
      cycleId={cycle.id}
      cycleRangeText={formatCycleRangeText(cycle, { includeYear: false }, budgetFrequency)}
      nextCycleRangeText={
        nextCycle ? formatCycleRangeText(nextCycle, { includeYear: false }, budgetFrequency) : null
      }
      financials={financials}
      goalsWithProgress={goalsWithProgress}
      recurringFulfillment={recurringFulfillment}
      comparison={comparison}
      sparklinePoints={sparklinePoints}
      uncategorized={computeUncategorizedWarning(financials)}
    />
  );
}
