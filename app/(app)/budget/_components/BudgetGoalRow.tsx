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
  actual,
  targetAmount,
  recurring,
  frequency,
  dueDay,
  expanded,
}: {
  goalId: string;
  categoryId: string;
  categoryName: string;
  actual: number;
  targetAmount: number;
  recurring: boolean;
  frequency: Frequency;
  dueDay: number | null;
  expanded: boolean;
}) {
  const usage = getBudgetUsage(actual, targetAmount);

  return (
    <div className="budget-goal-row">
      <div className="progress-bar-label">
        <span>
          <CategoryIcon name={categoryName} size={16} aria-hidden="true" /> {categoryName}
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
