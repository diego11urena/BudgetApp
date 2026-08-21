import Link from "next/link";
import { ProgressBar } from "../../_components/ProgressBar";
import { formatCurrency } from "@/lib/format";
import { getBudgetUsage } from "@/lib/budget-status";
import { CategoryIcon } from "@/lib/category-icons";
import { RecurringToggle } from "./RecurringToggle";
import { RecurringFrequencyControl } from "./RecurringFrequencyControl";
import { DeleteBudgetGoalButton } from "./DeleteBudgetGoalButton";

type Frequency = "BIWEEKLY" | "MONTHLY";

/**
 * The Recurring toggle, frequency control, and remove action all live
 * behind the list's shared edit mode (see BudgetGoalsPanel) rather than a
 * per-row toggle — every row reveals/hides its controls together, standard
 * iOS-style list edit mode.
 */
export function BudgetGoalRow({
  goalId,
  categoryId,
  categoryName,
  categoryIcon,
  actual,
  targetAmount,
  recurring,
  frequency,
  dueDay,
  expanded,
  cycleId,
}: {
  goalId: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string | null;
  actual: number;
  targetAmount: number;
  recurring: boolean;
  frequency: Frequency;
  dueDay: number | null;
  expanded: boolean;
  /** The active cycle's id -- a fixed-expense target is really just a spending cap on a category, so tapping the row's summary opens that category's transactions, scoped to this cycle. */
  cycleId: string;
}) {
  const usage = getBudgetUsage(actual, targetAmount);

  const summary = (
    <>
      <div className="progress-bar-label">
        <span>
          <CategoryIcon name={categoryName} icon={categoryIcon} size={16} aria-hidden="true" /> {categoryName}
        </span>
        <span>{usage.percentage}%</span>
      </div>
      <ProgressBar current={actual} target={targetAmount} colorState={usage.state} />
      <p className="field-hint" style={{ margin: "0.35rem 0 0" }}>
        {formatCurrency(actual)} / {formatCurrency(targetAmount)}
        {usage.overBy > 0 && (
          <span className="overage-text"> · {formatCurrency(usage.overBy)} over</span>
        )}
      </p>
    </>
  );

  return (
    <div className="budget-goal-row">
      {/* Not tappable-to-transactions while in edit mode -- that's a
          different interaction context (Recurring/Frequency/Remove
          controls below), so a stray tap here shouldn't navigate away. */}
      {expanded ? (
        <div>{summary}</div>
      ) : (
        <Link
          href={`/transactions?category=${categoryId}&cycleId=${cycleId}`}
          className="budget-goal-row-summary-link"
        >
          {summary}
        </Link>
      )}

      {expanded && (
        <div className="budget-goal-row-controls">
          <div className="budget-goal-row-controls-top">
            <RecurringToggle categoryId={categoryId} recurring={recurring} />
            <DeleteBudgetGoalButton goalId={goalId} categoryName={categoryName} />
          </div>
          {recurring && (
            <RecurringFrequencyControl categoryId={categoryId} frequency={frequency} dueDay={dueDay} />
          )}
        </div>
      )}
    </div>
  );
}
