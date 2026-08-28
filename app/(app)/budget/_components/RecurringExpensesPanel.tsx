"use client";

import { useState } from "react";
import { CategoryProgressRow } from "./CategoryProgressRow";
import { RecurringExpenseEditSheet } from "./RecurringExpenseEditSheet";
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
  const [adding, setAdding] = useState(false);
  const [addTriggerElement, setAddTriggerElement] = useState<HTMLElement | null>(null);

  return (
    <>
      <div className="section-header-row">
        <h2 style={{ marginBottom: 0, minWidth: 0, flex: "1 1 auto" }}>{dateRangeText}</h2>
        <button
          type="button"
          className="button button--secondary button--small"
          onClick={(e) => {
            setAddTriggerElement(e.currentTarget);
            setAdding(true);
          }}
        >
          + New recurring expense
        </button>
      </div>

      {categories.length === 0 && (
        <p className="field-hint">
          No recurring expenses yet — tap &quot;+ New recurring expense&quot; above.
        </p>
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

      {adding && (
        <RecurringExpenseEditSheet
          categoryNames={categoryNames}
          onDone={() => setAdding(false)}
          returnFocusTo={addTriggerElement}
        />
      )}
    </>
  );
}
