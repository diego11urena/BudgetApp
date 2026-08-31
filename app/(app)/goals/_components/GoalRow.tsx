"use client";

import { PartyPopper, ArrowRight } from "lucide-react";
import { computeGoalProjection } from "@/lib/goal-projection";
import { formatCurrency, formatFriendlyDate } from "@/lib/format";
import { CategoryIcon } from "@/lib/category-icons";
import { GoalRing } from "./GoalRing";
import { ContributeButton } from "./ContributeButton";
import { EditGoalSheet, type EditableGoal } from "./EditGoalSheet";
import { useSheet } from "../../_components/useSheet";
import type { GoalWithProgress } from "@/lib/goals";

/**
 * One row in Plan's Goals list -- same interaction model as
 * RecurringExpenseRow (Bills): tapping the row's main content opens the
 * edit sheet, and Contribute is the one action that stays persistently
 * visible, this list's own equivalent of Bills' "Record payment". Remove
 * now lives inside the edit sheet instead of competing as a third
 * always-visible button. Its own component (not inlined in GoalsSection's
 * map) because each row needs its own useSheet() call, and hooks can't
 * live inside a loop.
 */
export function GoalRow({ goal, categoryNames }: { goal: GoalWithProgress; categoryNames: string[] }) {
  const editSheet = useSheet();
  const projection = computeGoalProjection(goal);
  const editable: EditableGoal = {
    categoryId: goal.categoryId,
    name: goal.name,
    lifetimeTargetAmount: goal.lifetimeTargetAmount,
    currentCycleRecurringAmount: goal.currentCycleRecurringAmount,
    savedSoFar: goal.savedSoFar,
  };

  return (
    <div className="goal-row">
      <button type="button" className="goal-row-main" {...editSheet.triggerProps}>
        <GoalRing percentage={projection.percentage} complete={projection.isComplete} />
        <div className="goal-row-details">
          <p className="goal-row-name">
            <CategoryIcon name={goal.name} icon={goal.icon} size={16} aria-hidden="true" /> {goal.name}
          </p>
          <p className="field-hint">
            {formatCurrency(goal.savedSoFar)} / {formatCurrency(goal.lifetimeTargetAmount)}
          </p>
          {projection.isComplete ? (
            <p className="goal-projection goal-projection--complete">
              <PartyPopper size={16} aria-hidden="true" /> Goal reached!
            </p>
          ) : goal.currentCycleRecurringAmount !== null && projection.etaDate ? (
            <p className="goal-projection">
              Per-cycle contribution: {formatCurrency(goal.currentCycleRecurringAmount)}{" "}
              <ArrowRight size={14} aria-hidden="true" className="inline-arrow" /> on track
              to hit goal by {formatFriendlyDate(projection.etaDate)}
            </p>
          ) : (
            <p className="goal-projection goal-projection--muted">
              Set a per-cycle contribution to project a completion date.
            </p>
          )}
        </div>
      </button>

      <div className="goal-row-actions">
        <ContributeButton categoryName={goal.name} />
      </div>

      {editSheet.open && (
        <EditGoalSheet
          goal={editable}
          categoryNames={categoryNames}
          onDone={editSheet.close}
          {...editSheet.sheetProps}
        />
      )}
    </div>
  );
}
