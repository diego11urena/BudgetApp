import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import { getGoalsWithProgress } from "@/lib/goals";
import { getOrderedCategoryNames } from "@/lib/category-order";
import { computeGoalProjection } from "@/lib/goal-projection";
import { formatCurrency } from "@/lib/format";
import { iconForCategoryName } from "@/lib/category-icons";
import { GoalRing } from "./_components/GoalRing";
import { GoalForm } from "./_components/GoalForm";
import { RemoveGoalButton } from "./_components/RemoveGoalButton";
import { ContributeButton } from "./_components/ContributeButton";

function formatEtaDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function GoalsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const cycle = await getOrCreateDraftCycle(userId);
  const goals = await getGoalsWithProgress(userId, cycle.id);
  const [expenseCategoryNames, savingsCategoryNames] = await Promise.all([
    getOrderedCategoryNames(userId, cycle.id, "EXPENSE"),
    getOrderedCategoryNames(userId, cycle.id, "SAVINGS"),
  ]);

  return (
    <div className="home-page">
      <h1 className="page-title">Goals</h1>

      <div className="dashboard-section">
        <h2>Your savings goals</h2>
        {goals.length === 0 && <p className="field-hint">No goals yet — add one below.</p>}
        <div className="goal-list">
          {goals.map((goal) => {
            const projection = computeGoalProjection(goal);
            return (
              <div className="goal-row" key={goal.categoryId}>
                <div className="goal-row-main">
                  <GoalRing percentage={projection.percentage} complete={projection.isComplete} />
                  <div className="goal-row-details">
                    <p className="goal-row-name">
                      {iconForCategoryName(goal.name)} {goal.name}
                    </p>
                    <p className="field-hint">
                      {formatCurrency(goal.savedSoFar)} / {formatCurrency(goal.lifetimeTargetAmount)}
                    </p>
                    {projection.isComplete ? (
                      <p className="goal-projection goal-projection--complete">🎉 Goal reached!</p>
                    ) : goal.currentCycleRecurringAmount !== null && projection.etaDate ? (
                      <p className="goal-projection">
                        Per-cycle contribution: {formatCurrency(goal.currentCycleRecurringAmount)} →
                        on track to hit goal by {formatEtaDate(projection.etaDate)}
                      </p>
                    ) : (
                      <p className="goal-projection goal-projection--muted">
                        Set a per-cycle contribution below to project a completion date.
                      </p>
                    )}
                  </div>
                </div>
                <div className="goal-row-actions">
                  <ContributeButton
                    categoryName={goal.name}
                    expenseCategoryNames={expenseCategoryNames}
                    savingsCategoryNames={savingsCategoryNames}
                  />
                  <RemoveGoalButton categoryId={goal.categoryId} name={goal.name} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Add or update a goal</h2>
        <p className="field-hint" style={{ marginBottom: "0.75rem" }}>
          Log a savings transaction under the same name (e.g. &quot;Pro Futuro&quot;) any time and
          it&apos;ll count toward this goal automatically.
        </p>
        <GoalForm categoryNames={savingsCategoryNames} />
      </div>
    </div>
  );
}
