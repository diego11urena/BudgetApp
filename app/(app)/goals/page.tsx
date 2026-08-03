import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import { getGoalsWithProgress } from "@/lib/goals";
import { getOrderedCategoryNames } from "@/lib/category-order";
import { formatCurrency } from "@/lib/format";
import { iconForCategoryName } from "@/lib/category-icons";
import { ProgressBar } from "../_components/ProgressBar";
import { GoalForm } from "./_components/GoalForm";
import { removeGoalAction } from "./actions";

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
        <h2>Your savings goals</h2>
        {goals.length === 0 && <p className="field-hint">No goals yet — add one below.</p>}
        <div className="goal-list">
          {goals.map((goal) => (
            <div className="goal-row" key={goal.categoryId}>
              <div className="progress-bar-label">
                <span>
                  {iconForCategoryName(goal.name)} {goal.name}
                </span>
                <span>
                  {formatCurrency(goal.savedSoFar)} / {formatCurrency(goal.lifetimeTargetAmount)}
                </span>
              </div>
              <ProgressBar current={goal.savedSoFar} target={goal.lifetimeTargetAmount} />
              {goal.currentCycleRecurringAmount !== null && (
                <p className="field-hint" style={{ marginTop: "0.35rem" }}>
                  {formatCurrency(goal.currentCycleRecurringAmount)} per cycle
                </p>
              )}
              <form action={removeGoalAction} style={{ marginTop: "0.5rem" }}>
                <input type="hidden" name="categoryId" value={goal.categoryId} />
                <button
                  type="submit"
                  className="icon-button"
                  aria-label={`Remove ${goal.name} goal`}
                >
                  Remove goal
                </button>
              </form>
            </div>
          ))}
        </div>
      </div>

      <div className="dashboard-section">
        <h2>Add or update a goal</h2>
        <GoalForm categoryNames={savingsCategoryNames} />
      </div>
    </div>
  );
}
