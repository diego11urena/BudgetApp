"use client";

import { RecurringExpenseEditSheet } from "../../budget/_components/RecurringExpenseEditSheet";
import { RecurringExpenseRow, type RecurringExpenseRowData } from "../../budget/_components/RecurringExpenseRow";
import { useSheet } from "../../_components/useSheet";
import { EmptyState } from "../../_components/EmptyState";
import { formatCurrency } from "@/lib/format";
import type { CategoryWithRecurringExpenses, RecurringExpensesSummary } from "@/lib/recurring-expenses";
import { useT } from "@/app/_components/LocaleProvider";

interface FlatBill extends RecurringExpenseRowData {
  categoryName: string;
}

/**
 * Flattens category -> expenses[] into one list, sorted by due day across
 * the whole set (not per-category) -- the same dueDay-first order
 * getRecurringExpensesForCycle already applies within a category, now
 * applied globally since there's no more category grouping to sort
 * within. Matches the fix list's "plana por defecto, la categoría como
 * etiqueta" call: onboarding creates one bill per category by default, so
 * the old category-folder UI was, for most users, an extra tap to reveal
 * a folder containing exactly one thing with the same name.
 */
function flattenBills(categories: CategoryWithRecurringExpenses[]): FlatBill[] {
  return categories
    .flatMap((category) => category.expenses.map((expense) => ({ ...expense, categoryName: category.categoryName })))
    .sort((a, b) => (a.dueDay ?? Infinity) - (b.dueDay ?? Infinity));
}

export function BillsSection({
  categories,
  categoryNames,
  summary,
}: {
  categories: CategoryWithRecurringExpenses[];
  categoryNames: string[];
  /** Computed server-side (summarizeRecurringExpenses) and passed down --
   * that function lives in lib/recurring-expenses.ts, which also imports
   * lib/prisma.ts, so calling it from this "use client" component would
   * pull Prisma/pg into the browser bundle. */
  summary: RecurringExpensesSummary;
}) {
  const { open: adding, triggerProps, sheetProps, close } = useSheet();
  const bills = flattenBills(categories);
  const t = useT();

  return (
    <>
      <div className="section-header-row">
        <h2 style={{ marginBottom: 0, minWidth: 0, flex: "1 1 auto" }}>{t.plan.bills.title}</h2>
        <button type="button" className="button button--chip" {...triggerProps}>
          {t.plan.bills.newBill}
        </button>
      </div>

      {bills.length === 0 && <EmptyState>{t.plan.bills.empty}</EmptyState>}

      {summary.totalCount > 0 && (
        <div className="bills-summary-bar">
          <div className="bills-summary-bar-text">
            <span className="bills-summary-bar-count">
              {t.plan.bills.paidOfTotal(String(summary.paidCount), String(summary.totalCount))}
            </span>
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill progress-bar-fill--navy"
                style={{ width: `${(summary.paidCount / summary.totalCount) * 100}%` }}
              />
            </div>
          </div>
          {summary.pendingAmount > 0 && (
            <span className="bills-summary-bar-remaining">{formatCurrency(summary.pendingAmount)}</span>
          )}
        </div>
      )}

      <div className="recurring-expense-list recurring-expense-list--flat">
        {bills.map((bill) => (
          <RecurringExpenseRow
            key={bill.id}
            expense={bill}
            categoryName={bill.categoryName}
            categoryNames={categoryNames}
            showCategoryLabel
            simplifiedStatus
          />
        ))}
      </div>

      {adding && <RecurringExpenseEditSheet categoryNames={categoryNames} onDone={close} {...sheetProps} />}
    </>
  );
}
