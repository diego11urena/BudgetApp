import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAdjacentCycles, getOrCreateDraftCycle, getRecentCycles } from "@/lib/cycles";
import { getCycleFinancials, summarizeCycleFinancials } from "@/lib/cycle-financials";
import { getOrderedCategoryNames } from "@/lib/category-order";
import { generateInsights } from "@/lib/insights";
import { getRecurringExpensesForCycle, summarizeRecurringExpenses } from "@/lib/recurring-expenses";
import { getGoalsWithProgress } from "@/lib/goals";
import { addDays, formatCycleLabel } from "@/lib/pay-date";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Header } from "./_components/Header";
import { HeroCard } from "./_components/HeroCard";
import { BudgetBreakdownCard } from "./_components/BudgetBreakdownCard";
import { TopCategoriesChart } from "./_components/TopCategoriesChart";
import { InsightsCard } from "./_components/InsightsCard";
import { NeedsAttentionBanner } from "./_components/NeedsAttentionBanner";
import { TransactionList } from "../_components/TransactionList";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

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
    needsAttentionTransactionsRaw,
  ] = await Promise.all([
    getCycleFinancials(cycle.id),
    getAdjacentCycles(userId, cycle),
    getOrderedCategoryNames(userId, cycle.id, "EXPENSE"),
    getOrderedCategoryNames(userId, cycle.id, "SAVINGS"),
    getOrderedCategoryNames(userId, cycle.id, "INCOME"),
    getRecentCycles(userId),
    getRecurringExpensesForCycle(userId, cycle.id, { computeSuggestions: false }),
    getGoalsWithProgress(userId, cycle.id),
    // A transaction can be missing a category, a description, or both --
    // most commonly a Yappy/Gmail import with no learned-merchant category
    // AND no message attached. One query, one combined list, so a
    // transaction missing both never has to be finished across two separate
    // banners/sheets (see NeedsAttentionSheet). "Needs a category": every
    // type now has a category concept (Extra income included, see
    // lib/categories.ts), so this isn't EXPENSE-specific. "Needs a
    // description": Yappy is P2P, so the counterparty's name alone (the only
    // thing every notification email guarantees) doesn't say what the money
    // was for -- Yappy's own optional "Mensaje" note fills that gap when the
    // sender used it (see lib/gmail-parsers.ts), and this catches the rest,
    // in both directions: a sent transfer is EXPENSE/paymentMethod YAPPY, a
    // received one is INCOME/importSource GMAIL (the only way an INCOME
    // import can exist at all -- see gmail-parsers.ts's
    // yappyReceivedParser). Scoped to the current cycle only, consistent
    // with the rest of this page.
    prisma.cycleTransaction.findMany({
      where: {
        cycleId: cycle.id,
        OR: [
          { expenseCategoryId: null },
          {
            description: null,
            OR: [{ paymentMethod: "YAPPY" }, { type: "INCOME", importSource: "GMAIL" }],
          },
        ],
      },
      select: {
        id: true,
        name: true,
        amount: true,
        type: true,
        expenseCategoryId: true,
        description: true,
        paymentMethod: true,
        importSource: true,
      },
      orderBy: { occurredAt: "desc" },
    }),
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

  const insights = generateInsights(financials, previousClosedFinancials, {
    cycle: { periodStart: cycle.periodStart, periodEnd: cycle.periodEnd },
    recurringExpenseCategories,
    goals,
  });

  const needsAttentionTransactions = needsAttentionTransactionsRaw.map((t) => ({
    id: t.id,
    name: t.name,
    amount: t.amount.toNumber(),
    type: t.type,
    needsCategory: t.expenseCategoryId === null,
    needsDescription:
      t.description === null &&
      (t.paymentMethod === "YAPPY" || (t.type === "INCOME" && t.importSource === "GMAIL")),
    direction: t.type === "INCOME" ? ("received" as const) : ("sent" as const),
  }));

  return (
    <div className="home-page">
      <Header
        name={session.user.name}
        currentPayAmount={financials.baseIncome}
        currentPayDate={formatCycleLabel(cycle.periodStart)}
        cycleId={cycle.id}
        previousBoundDate={previousBoundDate}
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

      <div className="dashboard-section dashboard-section--plain">
        <HeroCard
          amountLeft={financials.amountLeft}
          periodStart={cycle.periodStart}
          periodEnd={cycle.periodEnd}
          totalExpenses={financials.totalExpenses}
        />
      </div>

      {/* InsightsCard itself renders null when there's nothing to say, so
          this costs nothing for a user with no insights yet. */}
      <div className="dashboard-section dashboard-section--plain">
        <InsightsCard insights={insights} />
      </div>

      <div className="dashboard-section">
        <BudgetBreakdownCard
          baseIncome={financials.baseIncome}
          extraIncome={financials.extraIncome}
          saved={financials.totalSavings}
          recurringExpenses={recurringExpensesSummary}
        />
      </div>

      <div className="dashboard-section">
        <TopCategoriesChart categories={financials.topCategories} />
      </div>

      <div className="dashboard-section">
        <h2>Recent transactions</h2>
        <TransactionList
          transactions={financials.transactions.slice(0, 3)}
          expenseCategoryNames={expenseCategoryNames}
          savingsCategoryNames={savingsCategoryNames}
          incomeCategoryNames={incomeCategoryNames}
          cycleStartDate={formatCycleLabel(cycle.periodStart)}
        />
        {financials.transactions.length > 3 && (
          <Link href="/transactions" className="line-item line-item--link">
            <span>See all</span>
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
}
