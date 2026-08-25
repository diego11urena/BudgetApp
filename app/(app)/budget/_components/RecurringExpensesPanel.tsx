"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { InfoTooltip } from "../../_components/InfoTooltip";
import { markRecurringExpenseHintSeenAction } from "../actions";
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
  hasSeenHint,
}: {
  categories: CategoryWithRecurringExpenses[];
  categoryNames: string[];
  /** e.g. "Aug 11–25" -- the card header, not a third repeat of the page title. */
  dateRangeText: string;
  /** Whether this user has ever had the explainer tooltip auto-shown before — false auto-opens it once, right here, on mount. */
  hasSeenHint: boolean;
}) {
  const [hintOpen, setHintOpen] = useState(() => !hasSeenHint);
  const [hintTriggerElement, setHintTriggerElement] = useState<HTMLElement | null>(null);
  const [adding, setAdding] = useState(false);
  const [addTriggerElement, setAddTriggerElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Marked seen the moment it auto-opens, not on dismiss -- so
    // navigating away mid-tooltip still counts as "shown once," matching
    // "auto-show once ever" rather than "auto-show until dismissed."
    if (!hasSeenHint) {
      markRecurringExpenseHintSeenAction();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.5rem",
          marginBottom: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", flex: "1 1 auto", minWidth: 0 }}>
          <h2 style={{ marginBottom: 0, minWidth: 0 }}>{dateRangeText}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="What are recurring expenses?"
            onClick={(e) => {
              setHintTriggerElement(e.currentTarget);
              setHintOpen(true);
            }}
          >
            <Info size={16} aria-hidden="true" />
          </button>
        </div>
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

      {hintOpen && (
        <InfoTooltip
          title="Recurring expenses"
          onClose={() => setHintOpen(false)}
          returnFocusTo={hintTriggerElement}
        >
          Each category can hold several recurring expenses — tap a category to see what&apos;s
          inside it and each one&apos;s own payment status this quincena, or tap a recurring
          expense directly to edit it. Savings goals live on the Goals tab.
        </InfoTooltip>
      )}

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
