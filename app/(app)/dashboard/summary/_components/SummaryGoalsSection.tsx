import Link from "next/link";
import { formatCurrency } from "@/lib/format";
import ProgressRing from "@/app/(app)/_components/charts/ProgressRing";
import type { GoalWithProgress } from "@/lib/goals";
import type { Dictionary } from "@/lib/i18n/dictionary";

interface SummaryGoalsSectionProps {
  goals: GoalWithProgress[];
  t: Dictionary;
}

export default function SummaryGoalsSection({ goals, t }: SummaryGoalsSectionProps) {
  const completedGoals = goals.filter((g) => g.lifetimeTargetAmount > 0 && g.savedSoFar >= g.lifetimeTargetAmount);
  const inProgressGoals = goals.filter((g) => g.lifetimeTargetAmount > 0 && g.savedSoFar < g.lifetimeTargetAmount);

  if (completedGoals.length === 0 && inProgressGoals.length === 0) {
    return null;
  }

  return (
    <section className="summary-goals-section">
      <h2 className="summary-section-eyebrow">{t.summary.goalsEyebrow}</h2>

      {completedGoals.map((goal) => (
        <Link key={goal.categoryId} href={`/goals/${goal.categoryId}`} className="summary-goals-completed">
          {goal.icon && <span className="summary-goals-icon">{goal.icon}</span>}
          <span>{t.summary.goalCompleted(goal.name)}</span>
        </Link>
      ))}

      {inProgressGoals.map((goal) => (
        <Link key={goal.categoryId} href={`/goals/${goal.categoryId}`} className="summary-goals-in-progress">
          <ProgressRing fraction={Math.min(1, goal.savedSoFar / (goal.lifetimeTargetAmount || 1))} />
          <span>
            {t.summary.goalInProgress(
              goal.name,
              formatCurrency(goal.savedSoFar),
              Math.min(100, (goal.savedSoFar / (goal.lifetimeTargetAmount || 1)) * 100),
              formatCurrency(goal.lifetimeTargetAmount || 0)
            )}
          </span>
          <span className="summary-goals-chevron">›</span>
        </Link>
      ))}
    </section>
  );
}
