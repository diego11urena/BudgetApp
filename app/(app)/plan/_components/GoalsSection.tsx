import { EmptyState } from "../../_components/EmptyState";
import { AddGoalSheet } from "../../goals/_components/AddGoalSheet";
import { GoalRow } from "../../goals/_components/GoalRow";
import type { GoalWithProgress } from "@/lib/goals";

/** Extracted from the old standalone /goals page, unchanged, for Plan's second section -- see the Balboa fix list's batch 11: Bills and Goals both answer "what did I plan to do with this paycheck," both are edited rarely and read often, so they now share one screen instead of each costing their own nav slot. */
export function GoalsSection({ goals, savingsCategoryNames }: { goals: GoalWithProgress[]; savingsCategoryNames: string[] }) {
  return (
    <>
      <div className="section-header-row">
        <h2 style={{ marginBottom: 0, flex: "1 1 auto", minWidth: 0 }}>Savings goals</h2>
        <AddGoalSheet categoryNames={savingsCategoryNames} />
      </div>
      {goals.length === 0 && <EmptyState>No goals yet — tap &quot;+ Add goal&quot; above.</EmptyState>}
      <div className="goal-list">
        {goals.map((goal) => (
          <GoalRow key={goal.categoryId} goal={goal} categoryNames={savingsCategoryNames} />
        ))}
      </div>
    </>
  );
}
