"use client";

import { CategoryProgressRow } from "./CategoryProgressRow";
import { RecurringExpenseEditSheet } from "./RecurringExpenseEditSheet";
import { useSheet } from "../../_components/useSheet";
import { EmptyState } from "../../_components/EmptyState";
import type { CategoryWithRecurringExpenses } from "@/lib/recurring-expenses";

/**
 * Replaces the old shared edit-mode toggle (BudgetGoalsPanel) entirely --
 * individual recurring expenses are now directly tappable at all times, so
 * there's no "Edit"/"Done" list-wide mode to own anymore. The one header
 * action is "+ New recurring expense".
 */
export function RecurringExpensesPanel({
  categories,
  categoryNames,
  dateRangeText,
}: {
  categories: CategoryWithRecurringExpenses[];
  categoryNames: string[];
  /** e.g. "Aug 11–25" -- the card header, not a third repeat of the page title. */
  dateRangeText: string;
}) {
  const { open: adding, triggerProps, sheetProps, close } = useSheet();

  return (
    <>
      <div className="section-header-row">
        <h2 style={{ marginBottom: 0, minWidth: 0, flex: "1 1 auto" }}>{dateRangeText}</h2>
        <button type="button" className="button button--secondary button--small" {...triggerProps}>
          + New recurring expense
        </button>
      </div>

      {categories.length === 0 && (
        <EmptyState>No recurring expenses yet — tap &quot;+ New recurring expense&quot; above.</EmptyState>
      )}

      <div className="category-progress-list">
        {categories.map((category) => (
          <CategoryProgressRow
            key={category.categoryId}
            categoryName={category.categoryName}
            categoryIcon={category.categoryIcon}
            actual={category.actual}
            targetAmount={category.targetAmount}
            expenses={category.expenses}
            categoryNames={categoryNames}
          />
        ))}
      </div>

      {adding && <RecurringExpenseEditSheet categoryNames={categoryNames} onDone={close} {...sheetProps} />}
    </>
  );
}
