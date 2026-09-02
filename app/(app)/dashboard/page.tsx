import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getAdjacentCycles, getOrCreateDraftCycle, getRecentCycles } from "@/lib/cycles";
import { getCycleFinancials, summarizeCycleFinancials } from "@/lib/cycle-financials";
import { getOrderedCategoryNames } from "@/lib/category-order";
import { generateInsights } from "@/lib/insights";
import { getRecurringExpensesForCycle, summarizeRecurringExpenses } from "@/lib/recurring-expenses";
import { getGoalsWithProgress } from "@/lib/goals";
import { getNeedsAttentionTransactions } from "@/lib/needs-attention";
import { addDays, formatCycleLabel } from "@/lib/pay-date";
import { formatCycleRangeLabel } from "@/lib/format";
import { computeQuincenaPace } from "@/lib/quincena-pace";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Header } from "./_components/Header";
import { HeroCard } from "./_components/HeroCard";
import { StatGrid } from "./_components/StatGrid";
import { TopCategoriesChart } from "./_components/TopCategoriesChart";
import { InsightsCard } from "./_components/InsightsCard";
import { NeedsAttentionBanner } from "./_components/NeedsAttentionBanner";
import { PaydayOverdueBanner } from "./_components/PaydayOverdueBanner";
import { TransactionList } from "../_components/TransactionList";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getRequestLocale());
  return { title: t.dashboard.metaTitle };
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const t = getDictionary(await getRequestLocale());

  const cycle = await getOrCreateDraftCycle(userId);

  // Everything below only depends on `cycle`/`userId`, not on each other --
  // one Promise.all instead of a waterfall of sequential awaits (matching
  // the pattern history/[cycleId]/page.tsx already uses). insights (sync,
  // below) is the one thing that has to wait for several of these results.
  const [
    financials,
    { previous: previousCycle },
    expenseCategoryNames,
    savingsCategoryNames,
    incomeCategoryNames,
    recentCycles,
    // computeSuggestions: false -- Insights only needs paid/unpaid status
    // and dollar amounts, not this cycle's best-effort match suggestions
    // (that's the Recurring Expenses tab's own concern, not something an
    // Insight line surfaces or acts on).
    recurringExpenseCategories,
    goals,
    needsAttentionTransactions,
  ] = await Promise.all([
    getCycleFinancials(cycle.id),
    getAdjacentCycles(userId, cycle),
    getOrderedCategoryNames(userId, cycle.id, "EXPENSE"),
    getOrderedCategoryNames(userId, cycle.id, "SAVINGS"),
    getOrderedCategoryNames(userId, cycle.id, "INCOME"),
    getRecentCycles(userId),
    getRecurringExpensesForCycle(userId, cycle.id, { computeSuggestions: false }),
    getGoalsWithProgress(userId, cycle.id),
    getNeedsAttentionTransactions(cycle.id),
  ]);

  // Exclusive neighbor boundary -> inclusive HTML date-input min, same
  // conversion /history/[cycleId]/page.tsx uses -- so "Edit"'s date picker
  // and assessPayDateChange's own boundary check can never disagree about
  // the earliest valid pay date for this cycle.
  const previousBoundDate = previousCycle ? formatCycleLabel(addDays(previousCycle.periodStart, 1)) : null;

  const closedCycles = recentCycles.filter((c) => c.status === "CLOSED" && c.id !== cycle.id);
  const previousClosedFinancials = closedCycles.map((c) =>
    summarizeCycleFinancials(c.incomeEntries, c.transactions),
  );

  const recurringExpensesSummary = summarizeRecurringExpenses(recurringExpenseCategories);

  // "ended" once the calendar-derived quincena end has passed without the
  // user closing it yet -- getOrCreateDraftCycle keeps a cycle open
  // indefinitely otherwise, silently going stale (fix-list batch 11.5,
  // decision 2). amountLeft/totalExpenses only affect perDay/isOverPace
  // here, neither of which this banner reads -- passed through anyway
  // since they're already in hand and computeQuincenaPace requires them.
  const pace = computeQuincenaPace({
    periodStart: cycle.periodStart,
    periodEnd: cycle.periodEnd,
    now: new Date(),
    amountLeft: financials.amountLeft,
    totalExpenses: financials.totalExpenses,
  });

  const insights = generateInsights(financials, previousClosedFinancials, {
    cycle: { periodStart: cycle.periodStart, periodEnd: cycle.periodEnd },
    recurringExpenseCategories,
    goals,
    t: t.insights,
  });

  // A goal counts as "funded" once savedSoFar has reached its own target --
  // StatGrid's Saved tile sub-line, and only meaningful for goals that
  // actually have a target set (lifetimeTargetAmount > 0).
  const fundedGoalsCount = goals.filter(
    (g) => g.lifetimeTargetAmount > 0 && g.savedSoFar >= g.lifetimeTargetAmount,
  ).length;

  return (
    <div className="home-page">
      <Header
        name={session.user.name}
        currentPayAmount={financials.baseIncome}
        currentPayDate={formatCycleLabel(cycle.periodStart)}
        cycleId={cycle.id}
        previousBoundDate={previousBoundDate}
        dateRangeLabel={formatCycleRangeLabel(cycle.periodStart, pace.cycleEnd)}
      />

      {/* Action-required banners (missing category, missing description)
          always render first — they're calls to action, something the
          user actually needs to do. HeroCard comes next: it's the number
          that anchors the whole screen, so it belongs above the fold on a
          real phone, not pushed under a card whose own text used to repeat
          that exact number. Insights follows -- context on that number,
          not a substitute for it. */}
      {needsAttentionTransactions.length > 0 && (
        <div className="dashboard-section dashboard-section--plain">
          <NeedsAttentionBanner
            transactions={needsAttentionTransactions}
            expenseCategoryNames={expenseCategoryNames}
            incomeCategoryNames={incomeCategoryNames}
            savingsCategoryNames={savingsCategoryNames}
          />
        </div>
      )}

      {/* Always mounted, regardless of pace.phase -- see PaydayOverdueBanner's
          own doc comment for why gating its mount (rather than just its
          trigger's visibility) on this same server-derived condition would
          wipe its in-flight confirm/closed-summary state the moment
          justGotPaidAction succeeds and this very page re-fetches. No
          wrapping div here -- HeroCardActions owns its own
          .dashboard-section internally, rendered only alongside its
          button, never on its own (see its own doc comment for why an
          always-present empty one broke e2e's generic .dashboard-section
          waits elsewhere on this page). */}
      <PaydayOverdueBanner cycleEndDate={pace.cycleEnd} isOverdue={pace.phase === "ended"} />

      {/* A brand-new account otherwise has three half-empty cards below
          (no top category, no recent activity, no bills/goals paid-count)
          and nothing telling a first-time user what to actually do about
          it -- see the Balboa fix list's batch 11.7. */}
      {financials.transactions.length === 0 && recurringExpensesSummary.totalCount === 0 && goals.length === 0 && (
        <div className="dashboard-section dashboard-section--plain">
          <p className="banner banner--good" role="status">
            {t.dashboard.tapToLogFirst}
          </p>
        </div>
      )}

      <div className="dashboard-section dashboard-section--plain">
        <HeroCard
          amountLeft={financials.amountLeft}
          periodStart={cycle.periodStart}
          periodEnd={cycle.periodEnd}
          totalExpenses={financials.totalExpenses}
          pendingBills={recurringExpensesSummary.pendingAmount}
        />
      </div>

      <div className="dashboard-section dashboard-section--plain">
        <StatGrid
          baseIncome={financials.baseIncome}
          extraIncome={financials.extraIncome}
          spent={financials.totalExpenses}
          saved={financials.totalSavings}
          fundedGoalsCount={fundedGoalsCount}
          recurringExpenses={recurringExpensesSummary}
        />
      </div>

      <div className="dashboard-section">
        <TopCategoriesChart
          categories={financials.topCategories}
          title={t.dashboard.whereItsGoing}
          badge={t.dashboard.top6Badge}
        />
      </div>

      {/* InsightsCard itself renders null when there's nothing to say, so
          this costs nothing for a user with no insights yet. Below the
          chart now, not above it -- context on the numbers above, not a
          substitute for them (see the design system handoff's Home spec). */}
      <div className="dashboard-section dashboard-section--plain">
        <InsightsCard insights={insights} />
      </div>

      <div className="dashboard-section">
        <div className="section-header-row">
          <h2 style={{ marginBottom: 0 }}>{t.dashboard.recent}</h2>
          {financials.transactions.length > 3 && (
            <Link href="/transactions" className="section-header-link">
              {t.dashboard.seeAll}
              <ChevronRight size={16} aria-hidden="true" />
            </Link>
          )}
        </div>
        <TransactionList
          transactions={financials.transactions.slice(0, 3)}
          expenseCategoryNames={expenseCategoryNames}
          savingsCategoryNames={savingsCategoryNames}
          incomeCategoryNames={incomeCategoryNames}
          cycleStartDate={formatCycleLabel(cycle.periodStart)}
        />
      </div>
    </div>
  );
}
