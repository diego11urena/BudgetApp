"use client";

import { RecurringExpenseEditSheet } from "../../budget/_components/RecurringExpenseEditSheet";
import { RecurringExpenseRow, type RecurringExpenseRowData } from "../../budget/_components/RecurringExpenseRow";
import { useSheet } from "../../_components/useSheet";
import { EmptyState } from "../../_components/EmptyState";
import { formatCurrency } from "@/lib/format";
import type { CategoryWithRecurringExpenses, RecurringExpensesSummary } from "@/lib/recurring-expenses";
import { useT, useVocab } from "@/app/_components/LocaleProvider";

interface FlatRecurringExpense extends RecurringExpenseRowData {
  categoryName: string;
  chargedThisCycle: boolean;
}

/**
 * Flattens category -> expenses[] into one list, no more category-folder
 * grouping -- matches the fix list's "plana por defecto, la categoría como
 * etiqueta" call: onboarding creates one item per category by default, so
 * the old category-folder UI was, for most users, an extra tap to reveal
 * a folder containing exactly one thing with the same name.
 */
function flattenRecurringExpenses(categories: CategoryWithRecurringExpenses[]): FlatRecurringExpense[] {
  return categories.flatMap((category) =>
    category.expenses.map((expense) => ({ ...expense, categoryName: category.categoryName })),
  );
}

export function RecurringSection({
  categories,
  categoryNames,
  summary,
}: {
  categories: CategoryWithRecurringExpenses[];
  categoryNames: string[];
  /** Computed server-side (summarizeRecurringExpenses) and passed down --
   * that function lives in lib/recurring-expenses.ts, which also imports
   * lib/prisma.ts, so calling it from this "use client" component would
   * pull Prisma/pg into the browser bundle. Items charged this cycle only
   * -- see summarizeRecurringExpenses's own doc comment. */
  summary: RecurringExpensesSummary;
}) {
  const { open: adding, triggerProps, sheetProps, close } = useSheet();
  const items = flattenRecurringExpenses(categories);
  // One list of what's charged this cycle (undated items always are), then
  // the items dated outside it -- recomputed from the cycle on every load,
  // so an item moves between the two as its date enters or leaves the cycle.
  // Same order as getRecurringExpensesForCycle: soonest due day, undated last.
  const byDueDay = (a: FlatRecurringExpense, b: FlatRecurringExpense) =>
    (a.dueDay ?? Infinity) - (b.dueDay ?? Infinity) || a.name.localeCompare(b.name);
  const charged = items.filter((item) => item.chargedThisCycle).sort(byDueDay);
  const notCharged = items.filter((item) => !item.chargedThisCycle).sort(byDueDay);
  const t = useT();
  const vocab = useVocab();

  function renderRow(item: FlatRecurringExpense) {
    return (
      <RecurringExpenseRow
        key={item.id}
        expense={item}
        categoryName={item.categoryName}
        categoryNames={categoryNames}
        showCategoryLabel
        simplifiedStatus
      />
    );
  }

  return (
    <>
      <div className="section-header-row">
        <h2 style={{ marginBottom: 0, minWidth: 0, flex: "1 1 auto" }}>{t.plan.recurring.title}</h2>
        <button type="button" className="button button--chip" {...triggerProps}>
          {t.plan.recurring.addNew}
        </button>
      </div>

      {items.length === 0 && <EmptyState>{t.plan.recurring.empty}</EmptyState>}

      {summary.totalCount > 0 && (
        <div className="recurring-summary-bar">
          <div className="recurring-summary-bar-text">
            <span className="recurring-summary-bar-count">
              {t.plan.recurring.paidOfTotal(vocab, String(summary.paidCount), String(summary.totalCount))}
            </span>
            <div className="progress-bar-track">
              {/* Color comes from .recurring-summary-bar .progress-bar-fill
                  (gold) rather than a --navy modifier -- see that rule. */}
              <div
                className="progress-bar-fill"
                style={{ width: `${(summary.paidCount / summary.totalCount) * 100}%` }}
              />
            </div>
          </div>
          {summary.pendingAmount > 0 && (
            <span className="recurring-summary-bar-remaining">{formatCurrency(summary.pendingAmount)}</span>
          )}
        </div>
      )}

      {charged.length > 0 && (
        <div className="recurring-expense-list recurring-expense-list--flat recurring-expense-card">
          {charged.map(renderRow)}
        </div>
      )}

      {notCharged.length > 0 && (
        <>
          <h3 className="recurring-subsection-heading">{t.plan.recurring.notChargedHeading(vocab)}</h3>
          <div className="recurring-expense-list recurring-expense-list--flat recurring-expense-card">
            {notCharged.map(renderRow)}
          </div>
        </>
      )}

      {adding && <RecurringExpenseEditSheet categoryNames={categoryNames} onDone={close} {...sheetProps} />}
    </>
  );
}
