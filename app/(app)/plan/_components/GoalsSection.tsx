import { PartyPopper, ArrowRight } from "lucide-react";
import { computeGoalProjection } from "@/lib/goal-projection";
import { formatCurrency, formatFriendlyDate } from "@/lib/format";
import { CategoryIcon } from "@/lib/category-icons";
import { EmptyState } from "../../_components/EmptyState";
import { GoalRing } from "../../goals/_components/GoalRing";
import { AddGoalSheet } from "../../goals/_components/AddGoalSheet";
import { RemoveGoalButton } from "../../goals/_components/RemoveGoalButton";
import { ContributeButton } from "../../goals/_components/ContributeButton";
import { EditGoalButton } from "../../goals/_components/EditGoalButton";
import type { GoalWithProgress } from "@/lib/goals";

/** Extracted from the old standalone /goals page, unchanged, for Plan's second section -- see the Balboa fix list's batch 11: Bills and Goals both answer "what did I plan to do with this paycheck," both are edited rarely and read often, so they now share one screen instead of each costing their own nav slot. */
export function GoalsSection({ goals, savingsCategoryNames }: { goals: GoalWithProgress[]; savingsCategoryNames: string[] }) {
  return (
    <>
      <div className="section-header-row">
        <h2 style={{ marginBottom: 0, flex: "1 1 auto", minWidth: 0 }}>Your savings goals</h2>
        <AddGoalSheet categoryNames={savingsCategoryNames} />
      </div>
      {goals.length === 0 && <EmptyState>No goals yet — tap &quot;+ Add goal&quot; above.</EmptyState>}
      <div className="goal-list">
        {goals.map((goal) => {
          const projection = computeGoalProjection(goal);
          return (
            <div className="goal-row" key={goal.categoryId}>
              <div className="goal-row-main">
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
              </div>
              <div className="goal-row-actions">
                <ContributeButton categoryName={goal.name} />
                <EditGoalButton
                  goal={{
                    categoryId: goal.categoryId,
                    name: goal.name,
                    lifetimeTargetAmount: goal.lifetimeTargetAmount,
                    currentCycleRecurringAmount: goal.currentCycleRecurringAmount,
                    savedSoFar: goal.savedSoFar,
                  }}
                  categoryNames={savingsCategoryNames}
                />
                <RemoveGoalButton categoryId={goal.categoryId} name={goal.name} />
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
