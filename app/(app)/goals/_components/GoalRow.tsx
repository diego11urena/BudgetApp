"use client";

import { PartyPopper, ArrowRight } from "lucide-react";
import { computeGoalProjection } from "@/lib/goal-projection";
import { formatCurrency, formatFriendlyDate } from "@/lib/format";
import { CategoryIcon } from "@/lib/category-icons";
import { GoalRing } from "./GoalRing";
import { ContributeButton } from "./ContributeButton";
import { RemoveGoalButton } from "./RemoveGoalButton";
import { EditGoalSheet, type EditableGoal } from "./EditGoalSheet";
import { useSheet } from "../../_components/useSheet";
import type { GoalWithProgress } from "@/lib/goals";
import { useT, useBudgetFrequency } from "@/app/_components/LocaleProvider";

/**
 * One row in Plan's Goals list. The design system handoff's action row is
 * Contribute/Edit/Remove, all three persistently visible -- a reversal of
 * this same session's earlier "match Bills' tap-the-row model" decision,
 * made deliberately by the new design spec (Bills itself keeps the
 * tap-to-edit model; Goals doesn't). Its own component (not inlined in
 * GoalsSection's map) because each row needs its own useSheet() call, and
 * hooks can't live inside a loop.
 */
export function GoalRow({ goal, categoryNames }: { goal: GoalWithProgress; categoryNames: string[] }) {
  const t = useT();
  const budgetFrequency = useBudgetFrequency();
  const editSheet = useSheet();
  const projection = computeGoalProjection({ ...goal, frequency: budgetFrequency });
  const editable: EditableGoal = {
    categoryId: goal.categoryId,
    name: goal.name,
    lifetimeTargetAmount: goal.lifetimeTargetAmount,
    currentCycleRecurringAmount: goal.currentCycleRecurringAmount,
    savedSoFar: goal.savedSoFar,
  };

  return (
    <div className="goal-row">
      <div className="goal-row-main">
        <GoalRing percentage={projection.percentage} complete={projection.isComplete} />
        <div className="goal-row-details">
          <p className="goal-row-name">
            <CategoryIcon name={goal.name} icon={goal.icon} size={16} aria-hidden="true" /> {goal.name}
          </p>
          <p className="goal-row-progress">
            {t.goals.savedOf(formatCurrency(goal.savedSoFar), formatCurrency(goal.lifetimeTargetAmount))}
          </p>
          {projection.isComplete ? (
            <p className="goal-projection goal-projection--complete">
              <PartyPopper size={16} aria-hidden="true" /> {t.goals.reached}
            </p>
          ) : goal.currentCycleRecurringAmount !== null && projection.etaDate ? (
            <p className="goal-projection">
              {t.goals.onTrack(formatCurrency(goal.currentCycleRecurringAmount), formatFriendlyDate(projection.etaDate))}{" "}
              <ArrowRight size={14} aria-hidden="true" className="inline-arrow" />
            </p>
          ) : (
            <p className="goal-projection goal-projection--muted">
              {t.goals.setContribution}
            </p>
          )}
        </div>
      </div>

      <div className="goal-row-actions">
        <ContributeButton categoryName={goal.name} />
        <button type="button" className="button button--chip" {...editSheet.triggerProps}>
          {t.goals.edit}
        </button>
        <RemoveGoalButton categoryId={goal.categoryId} name={goal.name} />
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
