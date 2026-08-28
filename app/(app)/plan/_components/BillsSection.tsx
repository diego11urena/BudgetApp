"use client";

import { RecurringExpenseEditSheet } from "../../budget/_components/RecurringExpenseEditSheet";
import { RecurringExpenseRow, type RecurringExpenseRowData } from "../../budget/_components/RecurringExpenseRow";
import { useSheet } from "../../_components/useSheet";
import { EmptyState } from "../../_components/EmptyState";
import type { CategoryWithRecurringExpenses } from "@/lib/recurring-expenses";

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
}: {
  categories: CategoryWithRecurringExpenses[];
  categoryNames: string[];
}) {
  const { open: adding, triggerProps, sheetProps, close } = useSheet();
  const bills = flattenBills(categories);

  return (
    <>
      <div className="section-header-row">
        <h2 style={{ marginBottom: 0, minWidth: 0, flex: "1 1 auto" }}>Bills</h2>
        <button type="button" className="button button--secondary button--small" {...triggerProps}>
          + New bill
        </button>
      </div>

      {bills.length === 0 && <EmptyState>No bills yet — tap &quot;+ New bill&quot; above.</EmptyState>}

      <div className="recurring-expense-list recurring-expense-list--flat">
        {bills.map((bill) => (
          <RecurringExpenseRow
            key={bill.id}
            expense={bill}
            categoryName={bill.categoryName}
            categoryNames={categoryNames}
            showCategoryLabel
          />
        ))}
      </div>

      {adding && <RecurringExpenseEditSheet categoryNames={categoryNames} onDone={close} {...sheetProps} />}
    </>
  );
}
