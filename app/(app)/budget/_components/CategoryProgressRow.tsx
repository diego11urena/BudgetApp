"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ProgressBar } from "../../_components/ProgressBar";
import { formatCurrency } from "@/lib/format";
import { getBudgetUsage } from "@/lib/budget-status";
import { CategoryIcon } from "@/lib/category-icons";
import { RecurringExpenseRow, type RecurringExpenseRowData } from "./RecurringExpenseRow";

/**
 * A category is an expandable container, not itself a single expense --
 * tapping the whole row toggles its individual recurring expenses open
 * inline (never navigates to the Transactions tab, unlike the old
 * BudgetGoalRow this replaces). The chevron mirrors expanded state.
 */
export function CategoryProgressRow({
  categoryName,
  categoryIcon,
  actual,
  targetAmount,
  expenses,
  categoryNames = [],
  readOnly = false,
}: {
  categoryName: string;
  categoryIcon: string | null;
  actual: number;
  targetAmount: number;
  expenses: RecurringExpenseRowData[];
  categoryNames?: string[];
  /** History reuses this component for a closed cycle's breakdown -- no add/edit/delete/record-payment/confirm-match affordances, just the read. */
  readOnly?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const usage = getBudgetUsage(actual, targetAmount);

  return (
    <div className="category-progress-row">
      <button
        type="button"
        className="category-progress-row-summary"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown size={16} aria-hidden="true" className="category-progress-row-chevron" />
        ) : (
          <ChevronRight size={16} aria-hidden="true" className="category-progress-row-chevron" />
        )}
        <div className="category-progress-row-content">
          <div className="progress-bar-label">
            <span>
              <CategoryIcon name={categoryName} icon={categoryIcon} size={16} aria-hidden="true" /> {categoryName}
            </span>
            <span>{usage.percentage}%</span>
          </div>
          <ProgressBar current={actual} target={targetAmount} colorState={usage.state} />
          <p className="field-hint" style={{ margin: "0.35rem 0 0" }}>
            {formatCurrency(actual)} / {formatCurrency(targetAmount)}
            {usage.overBy > 0 && (
              <span className="overage-text"> · {formatCurrency(usage.overBy)} over</span>
            )}
          </p>
        </div>
      </button>

      {expanded && (
        <div className="recurring-expense-list">
          {expenses.map((expense) => (
            <RecurringExpenseRow
              key={expense.id}
              expense={expense}
              categoryName={categoryName}
              categoryNames={categoryNames}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
    </div>
  );
}
