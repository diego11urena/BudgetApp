"use client";

import { useState } from "react";
import { AddTargetSheet } from "./AddTargetSheet";
import { BudgetGoalRow } from "./BudgetGoalRow";

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
}: {
  rows: BudgetGoalRowData[];
  categoryNames: string[];
}) {
  const [editMode, setEditMode] = useState(false);

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
            — without it, the "Edit"/"+ Add fixed expense" group's
            flex-shrink: 0 claims its full width first and squeezes this
            heading down to a near-zero column, wrapping it word-by-word
            into several cramped lines that look like overlapping text.
            Wrapping lets the button group drop to its own line instead, so
            the heading keeps the full row width to wrap normally. */}
        <h2 style={{ marginBottom: 0, flex: "1 1 auto", minWidth: 0 }}>This quincena&apos;s fixed expenses</h2>
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
      <p className="field-hint" style={{ marginBottom: "0.75rem" }}>
        Recurring fixed expenses carry into every quincena by default — tap &quot;Edit&quot; to switch
        one to a specific day each month instead, or remove it.
      </p>
      {rows.length === 0 && (
        <p className="field-hint">No fixed expenses yet — tap &quot;+ Add fixed expense&quot; above.</p>
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
          />
        ))}
      </div>
    </>
  );
}
