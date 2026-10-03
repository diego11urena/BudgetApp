import Link from "next/link";
import { ChevronRight, CircleCheck } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import ProgressRing from "@/app/(app)/_components/charts/ProgressRing";
import type { GoalWithProgress } from "@/lib/goals";
import type { Dictionary } from "@/lib/i18n/dictionary";

interface SummaryGoalsSectionProps {
  goals: GoalWithProgress[];
  /** categoryId -> what went into that goal during THIS period (not its lifetime total). */
  contributions: Record<string, number>;
  t: Dictionary;
}

export default function SummaryGoalsSection({ goals, contributions, t }: SummaryGoalsSectionProps) {
  // A period's summary lists the goals that period actually moved: the
  // "+$150.00" on each row is what was contributed in it. A goal nothing
  // went into is left off rather than shown with its lifetime total
  // dressed up as a "+" for this period.
  const touched = goals.filter((g) => g.lifetimeTargetAmount > 0 && (contributions[g.categoryId] ?? 0) > 0);
  const completedGoals = touched.filter((g) => g.savedSoFar >= g.lifetimeTargetAmount);
  const inProgressGoals = touched.filter((g) => g.savedSoFar < g.lifetimeTargetAmount);

  if (touched.length === 0) {
    return null;
  }

  return (
    <section className="summary-goals-section">
      <h2 className="summary-section-eyebrow">{t.summary.goalsEyebrow}</h2>

      {completedGoals.map((goal) => (
        <Link key={goal.categoryId} href="/plan" className="summary-goals-completed">
          <CircleCheck size={22} aria-hidden="true" className="summary-goals-icon" />
          <span className="summary-goals-text">
            <span className="summary-goals-name">{t.summary.goalCompleted(goal.name)}</span>
            <span className="summary-goals-detail">
              {t.summary.goalCompletedDetail(
                formatCurrency(contributions[goal.categoryId] ?? 0),
                formatCurrency(goal.lifetimeTargetAmount),
              )}
            </span>
          </span>
        </Link>
      ))}

      {inProgressGoals.map((goal) => (
        <Link key={goal.categoryId} href="/plan" className="summary-goals-in-progress">
          <ProgressRing fraction={Math.min(1, goal.savedSoFar / (goal.lifetimeTargetAmount || 1))} />
          <span className="summary-goals-text">
            <span className="summary-goals-name">{goal.name}</span>
            <span className="summary-goals-detail">
              {t.summary.goalInProgress(
                formatCurrency(contributions[goal.categoryId] ?? 0),
                Math.min(100, (goal.savedSoFar / (goal.lifetimeTargetAmount || 1)) * 100),
                formatCurrency(goal.lifetimeTargetAmount || 0)
              )}
            </span>
          </span>
          <ChevronRight size={16} aria-hidden="true" className="summary-goals-chevron" />
        </Link>
      ))}
    </section>
  );
}
