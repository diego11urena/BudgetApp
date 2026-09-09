import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCycleFinancials, summarizeCycleFinancials } from "@/lib/cycle-financials";
import { getClosedCycles, getUserBudgetFrequency, formatCycleRangeText } from "@/lib/cycles";
import { getRecurringExpensesForCycle, summarizeRecurringExpenses } from "@/lib/recurring-expenses";
import { getGoalsWithProgress } from "@/lib/goals";
import { computeUncategorizedWarning } from "@/lib/summary";
import SummaryScreen from "../_components/SummaryScreen";

export const metadata: Metadata = { title: "Summary" };

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

  const [budgetFrequency, financials, goalsWithProgress, recurringExpenseCategories, closedCycles] = await Promise.all([
    getUserBudgetFrequency(userId),
    getCycleFinancials(cycle.id),
    getGoalsWithProgress(userId, cycle.id),
    getRecurringExpensesForCycle(userId, cycle.id, { computeSuggestions: false }),
    getClosedCycles(userId, 6),
  ]);

  // A bill still unpaid when the cycle closed counts as late -- the
  // confirmed rule for this screen (it's in both the total and the late
  // tally, never silently dropped).
  const bills = summarizeRecurringExpenses(recurringExpenseCategories);
  const billsLateCount = Math.max(bills.totalCount - bills.paidCount, 0);

  // Oldest-first, so the sparkline reads left-to-right through time and
  // ends on this cycle. Whatever history exists is what gets drawn -- a
  // brand-new account with one closed cycle gets a single dot, not a
  // fabricated trend.
  const sparklinePoints = [...closedCycles]
    .reverse()
    .map((c) => summarizeCycleFinancials(c.incomeEntries, c.transactions).totalExpenses);

  return (
    <SummaryScreen
      cycleId={cycle.id}
      cycleRangeText={formatCycleRangeText(cycle, {}, budgetFrequency)}
      financials={financials}
      goalsWithProgress={goalsWithProgress}
      billsPaidCount={bills.paidCount}
      billsTotalCount={bills.totalCount}
      billsLateCount={billsLateCount}
      sparklinePoints={sparklinePoints}
      uncategorized={computeUncategorizedWarning(financials)}
    />
  );
}
