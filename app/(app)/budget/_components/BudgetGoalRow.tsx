"use client";

import { useState } from "react";
import { ProgressBar } from "../../_components/ProgressBar";
import { formatCurrency } from "@/lib/format";
import { getBudgetUsage } from "@/lib/budget-status";
import { iconForCategoryName } from "@/lib/category-icons";
import { RecurringToggle } from "./RecurringToggle";
import { RecurringFrequencyControl } from "./RecurringFrequencyControl";
import { DeleteBudgetGoalButton } from "./DeleteBudgetGoalButton";

type Frequency = "BIWEEKLY" | "MONTHLY";

/**
 * Collapsed by default to just name/progress/percentage/$amounts — the
 * Recurring toggle, frequency control, and remove action all live behind
 * one edit icon instead of being always-visible, so a clean row is the
 * default state and the controls only take up space when actually needed.
 */
export function BudgetGoalRow({
  goalId,
  categoryId,
  categoryName,
  actual,
  targetAmount,
  recurring,
  frequency,
  dueDay,
}: {
  goalId: string;
  categoryId: string;
  categoryName: string;
  actual: number;
  targetAmount: number;
  recurring: boolean;
  frequency: Frequency;
  dueDay: number | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const usage = getBudgetUsage(actual, targetAmount);

  return (
    <div className="budget-goal-row">
      <div className="progress-bar-label">
        <span>
          {iconForCategoryName(categoryName)} {categoryName}
        </span>
        <span>{usage.percentage}%</span>
      </div>
      <ProgressBar current={actual} target={targetAmount} colorState={usage.state} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "0.35rem",
        }}
      >
        <p className="field-hint" style={{ margin: 0 }}>
          {formatCurrency(actual)} / {formatCurrency(targetAmount)}
          {usage.overBy > 0 && (
            <span className="overage-text"> · {formatCurrency(usage.overBy)} over</span>
          )}
        </p>
        <button
          type="button"
          className="icon-button"
          aria-expanded={expanded}
          aria-label={expanded ? `Hide ${categoryName}'s settings` : `Edit ${categoryName}'s settings`}
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? "✕" : "✏️"}
        </button>
      </div>

      {expanded && (
        <div className="budget-goal-row-controls">
          <div className="budget-goal-row-controls-top">
            <RecurringToggle categoryId={categoryId} recurring={recurring} />
            <DeleteBudgetGoalButton goalId={goalId} categoryName={categoryName} />
          </div>
          {recurring && (
            <RecurringFrequencyControl categoryId={categoryId} frequency={frequency} dueDay={dueDay} />
          )}
        </div>
      )}
    </div>
  );
}
