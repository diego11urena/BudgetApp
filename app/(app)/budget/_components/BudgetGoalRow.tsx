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
 * Collapsed by default to just name/progress/percentage/recurring
 * toggle/remove — the frequency control (BIWEEKLY vs MONTHLY + due day)
 * only matters for the rare monthly-due target, so it's tucked behind an
 * expand toggle instead of always taking up row space. The general
 * explanation of how recurring carries forward lives once in the section
 * header (budget/page.tsx) instead of repeating per row.
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
      <p className="field-hint" style={{ marginTop: "0.35rem" }}>
        {formatCurrency(actual)} / {formatCurrency(targetAmount)}
        {usage.overBy > 0 && (
          <span className="overage-text"> · {formatCurrency(usage.overBy)} over</span>
        )}
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: "0.5rem",
        }}
      >
        <RecurringToggle categoryId={categoryId} recurring={recurring} />
        <div style={{ display: "flex", alignItems: "center" }}>
          {recurring && (
            <button
              type="button"
              className="icon-button"
              aria-expanded={expanded}
              aria-label={
                expanded
                  ? `Hide ${categoryName}'s frequency settings`
                  : `Edit ${categoryName}'s frequency`
              }
              onClick={() => setExpanded((e) => !e)}
            >
              ⚙️ {expanded ? "Done" : "Frequency"}
            </button>
          )}
          <DeleteBudgetGoalButton goalId={goalId} categoryName={categoryName} />
        </div>
      </div>
      {recurring && expanded && (
        <RecurringFrequencyControl categoryId={categoryId} frequency={frequency} dueDay={dueDay} />
      )}
    </div>
  );
}
