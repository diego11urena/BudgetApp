"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { AddTargetSheet } from "./AddTargetSheet";
import { BudgetGoalRow } from "./BudgetGoalRow";
import { InfoTooltip } from "../../_components/InfoTooltip";
import { markFixedExpenseHintSeenAction } from "../actions";

export interface BudgetGoalRowData {
  id: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  actual: number;
  targetAmount: number;
  recurring: boolean;
  frequency: "BIWEEKLY" | "MONTHLY";
  dueDay: number | null;
}

/**
 * Owns the shared edit-mode toggle for the whole list — standard iOS-style
 * list editing, where one "Edit"/"Done" button reveals or hides every row's
 * Recurring/Frequency/Remove controls at once, rather than each row having
 * its own pencil icon.
 */
export function BudgetGoalsPanel({
  rows,
  categoryNames,
  dateRangeText,
  hasSeenHint,
  cycleId,
}: {
  rows: BudgetGoalRowData[];
  categoryNames: string[];
  /** e.g. "Aug 11–25" -- replaces a card header that used to just repeat "Fixed expenses" a third time. */
  dateRangeText: string;
  /** Whether this user has ever had the explainer tooltip auto-shown before — false auto-opens it once, right here, on mount. */
  hasSeenHint: boolean;
  /** The active cycle's id -- passed through to each row so tapping it can scope the Transactions link to this cycle. */
  cycleId: string;
}) {
  const [editMode, setEditMode] = useState(false);
  const [hintOpen, setHintOpen] = useState(() => !hasSeenHint);
  const [hintTriggerElement, setHintTriggerElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Marked seen the moment it auto-opens, not on dismiss -- so
    // navigating away mid-tooltip still counts as "shown once," matching
    // "auto-show once ever" rather than "auto-show until dismissed."
    if (!hasSeenHint) {
      markFixedExpenseHintSeenAction();
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
        {/* flex-wrap on the row (not a min-width on this heading) is the fix
            — without it, the "Edit"/"New fixed expense" group's
            flex-shrink: 0 claims its full width first and squeezes this
            heading down to a near-zero column, wrapping it word-by-word
            into several cramped lines that look like overlapping text.
            Wrapping lets the button group drop to its own line instead, so
            the heading keeps the full row width to wrap normally. */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", flex: "1 1 auto", minWidth: 0 }}>
          <h2 style={{ marginBottom: 0, minWidth: 0 }}>{dateRangeText}</h2>
          <button
            type="button"
            className="icon-button"
            aria-label="What are fixed expenses?"
            onClick={(e) => {
              setHintTriggerElement(e.currentTarget);
              setHintOpen(true);
            }}
          >
            <Info size={16} aria-hidden="true" />
          </button>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
          {rows.length > 0 && (
            <button
              type="button"
              className="button button--secondary button--small"
              onClick={() => setEditMode((e) => !e)}
            >
              {editMode ? "Done" : "Edit"}
            </button>
          )}
          <AddTargetSheet categoryNames={categoryNames} />
        </div>
      </div>
      {hintOpen && (
        <InfoTooltip
          title="Fixed expenses"
          onClose={() => setHintOpen(false)}
          returnFocusTo={hintTriggerElement}
        >
          Recurring fixed expenses carry into every quincena by default — tap &quot;Edit&quot; to switch
          one to a specific day each month instead, or remove it.
        </InfoTooltip>
      )}
      {rows.length === 0 && (
        <p className="field-hint">No fixed expenses yet — tap &quot;New fixed expense&quot; above.</p>
      )}
      <div className="budget-goal-list">
        {rows.map((row) => (
          <BudgetGoalRow
            key={row.id}
            goalId={row.id}
            categoryId={row.categoryId}
            categoryName={row.categoryName}
            categoryIcon={row.categoryIcon}
            actual={row.actual}
            targetAmount={row.targetAmount}
            recurring={row.recurring}
            frequency={row.frequency}
            dueDay={row.dueDay}
            expanded={editMode}
            cycleId={cycleId}
          />
        ))}
      </div>
    </>
  );
}
