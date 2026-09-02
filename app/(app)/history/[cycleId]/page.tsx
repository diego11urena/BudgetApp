import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAdjacentCycles, formatCycleRangeText, getOrCreateDraftCycle, getUserPayFrequency } from "@/lib/cycles";
import { getCycleFinancials } from "@/lib/cycle-financials";
import { getRecurringExpensesForCycle, summarizeRecurringExpenses } from "@/lib/recurring-expenses";
import { getOrderedCategoryNames } from "@/lib/category-order";
import { addDays, formatCycleLabel } from "@/lib/pay-date";
import { TransactionList } from "../../_components/TransactionList";
import { HeroCard } from "../../dashboard/_components/HeroCard";
import { BudgetBreakdownCard } from "../../dashboard/_components/BudgetBreakdownCard";
import { TopCategoriesChart } from "../../dashboard/_components/TopCategoriesChart";
import { EditPayInfoButton } from "../../dashboard/_components/EditPayInfoButton";
import { AddToCycleButton } from "../_components/AddToCycleButton";
import { CategoryProgressRow } from "../../budget/_components/CategoryProgressRow";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getRequestLocale());
  return { title: t.history.detailMetaTitle };
}

export default async function CycleHistoryPage({
  params,
}: {
  params: Promise<{ cycleId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const { cycleId } = await params;
  const t = getDictionary(await getRequestLocale());

  const cycle = await prisma.budgetCycle.findFirst({
    where: { id: cycleId, userId },
  });
  if (!cycle) {
    redirect("/history");
  }

  const closed = cycle.status === "CLOSED";

  // getOrderedCategoryNames is keyed by cycleId (see its own cache() doc
  // comment) -- calling it with the *current* draft cycle, not this
  // historical one, means it hits the same request-level cache entry
  // app/(app)/layout.tsx already populated for BottomNav, instead of
  // missing and re-running all 3 types' queries a second time just to
  // reorder chips slightly differently for a past cycle.
  const currentCycle = await getOrCreateDraftCycle(userId);

  const [financials, expenseCategoryNames, savingsCategoryNames, incomeCategoryNames, { previous, next }, payFrequency] =
    await Promise.all([
      getCycleFinancials(cycle.id),
      getOrderedCategoryNames(userId, currentCycle.id, "EXPENSE"),
      getOrderedCategoryNames(userId, currentCycle.id, "SAVINGS"),
      getOrderedCategoryNames(userId, currentCycle.id, "INCOME"),
      getAdjacentCycles(userId, cycle),
      getUserPayFrequency(userId),
    ]);

  // Historical category -> recurring-expense breakdown for this specific
  // cycle's own CycleRecurringExpense snapshots -- accurate even if a
  // recurring expense's price or category has changed since. No match
  // suggestions computed for a closed cycle -- nothing there is
  // actionable (see CategoryProgressRow's readOnly prop below).
  const recurringExpenseCategories = await getRecurringExpensesForCycle(userId, cycle.id, {
    computeSuggestions: !closed,
  });
  const recurringExpensesSummary = summarizeRecurringExpenses(recurringExpenseCategories);

  const cycleStartDate = formatCycleLabel(cycle.periodStart);
  // Exclusive neighbor boundaries -> inclusive HTML date-input min/max for
  // EditPayInfoSheet's pay-date field.
  const previousBoundDate = previous ? formatCycleLabel(addDays(previous.periodStart, 1)) : null;
  const nextBoundDate = next ? formatCycleLabel(addDays(next.periodStart, -1)) : null;

  return (
    <div className="home-page">
      <Link href="/history" className="back-link">
        <ChevronLeft size={16} aria-hidden="true" /> {t.history.back}
      </Link>

      <div className="home-header">
        <div>
          <p className="home-greeting">{formatCycleRangeText(cycle, {}, payFrequency)}</p>
          <div className="home-month">
            {closed ? t.history.closed : t.history.active}
            {closed && (
              <EditPayInfoButton
                currentAmount={financials.baseIncome}
                currentPayDate={cycleStartDate}
                cycleId={cycle.id}
                closed
                previousBoundDate={previousBoundDate}
                nextBoundDate={nextBoundDate}
              />
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-section dashboard-section--plain">
        <HeroCard
          amountLeft={financials.amountLeft}
          periodStart={cycle.periodStart}
          totalExpenses={financials.totalExpenses}
          closed={closed}
          payFrequency={payFrequency}
        />
      </div>

      <div className="dashboard-section">
        <BudgetBreakdownCard
          baseIncome={financials.baseIncome}
          extraIncome={financials.extraIncome}
          saved={financials.totalSavings}
          recurringExpenses={recurringExpensesSummary}
        />
      </div>

      {recurringExpenseCategories.length > 0 && (
        <div className="dashboard-section">
          <h2 style={{ marginBottom: "0.5rem" }}>{t.history.bills}</h2>
          <div className="category-progress-list">
            {recurringExpenseCategories.map((category) => (
              <CategoryProgressRow
                key={category.categoryId}
                categoryName={category.categoryName}
                categoryIcon={category.categoryIcon}
                actual={category.actual}
                budgetTotal={category.budgetTotal}
                expenses={category.expenses}
                readOnly={closed}
              />
            ))}
          </div>
        </div>
      )}

      <div className="dashboard-section">
        <TopCategoriesChart categories={financials.topCategories} title={t.dashboard.topCategoriesTitle} />
      </div>

      <div className="dashboard-section">
        <div className="section-header-row">
          <h2 style={{ marginBottom: 0, flex: "1 1 auto", minWidth: 0 }}>{t.history.transactions}</h2>
          <AddToCycleButton
            cycleId={cycle.id}
            cycleStartDate={cycleStartDate}
            expenseCategoryNames={expenseCategoryNames}
            savingsCategoryNames={savingsCategoryNames}
            incomeCategoryNames={incomeCategoryNames}
          />
        </div>
        <TransactionList
          transactions={financials.transactions}
          expenseCategoryNames={expenseCategoryNames}
          savingsCategoryNames={savingsCategoryNames}
          incomeCategoryNames={incomeCategoryNames}
          cycleStartDate={cycleStartDate}
          emptyMessage={t.history.empty2}
        />
      </div>
    </div>
  );
}
