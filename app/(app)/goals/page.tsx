import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PartyPopper, ArrowRight } from "lucide-react";
import { auth } from "@/lib/auth";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import { getGoalsWithProgress } from "@/lib/goals";
import { getOrderedCategoryNames } from "@/lib/category-order";
import { computeGoalProjection } from "@/lib/goal-projection";
import { formatCurrency, formatFriendlyDate } from "@/lib/format";
import { CategoryIcon } from "@/lib/category-icons";
import { GoalRing } from "./_components/GoalRing";
import { AddGoalSheet } from "./_components/AddGoalSheet";
import { RemoveGoalButton } from "./_components/RemoveGoalButton";
import { ContributeButton } from "./_components/ContributeButton";
import { EditGoalButton } from "./_components/EditGoalButton";

export const metadata: Metadata = { title: "Goals" };

export default async function GoalsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const cycle = await getOrCreateDraftCycle(userId);
  const goals = await getGoalsWithProgress(userId, cycle.id);
  const savingsCategoryNames = await getOrderedCategoryNames(userId, cycle.id, "SAVINGS");

  return (
    <div className="home-page">
      <h1 className="page-title">Goals</h1>

      <div className="dashboard-section">
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
          {/* flex-wrap here for the same reason as BudgetGoalsPanel's header
              row — lets the action button drop to its own line instead of
              squeezing this heading down to a near-zero column. */}
          <h2 style={{ marginBottom: 0, flex: "1 1 auto", minWidth: 0 }}>Your savings goals</h2>
          <AddGoalSheet categoryNames={savingsCategoryNames} />
        </div>
        {goals.length === 0 && (
          <p className="field-hint">No goals yet — tap &quot;+ Add goal&quot; above.</p>
        )}
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
      </div>
    </div>
  );
}
