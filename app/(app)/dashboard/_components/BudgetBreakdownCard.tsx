import { ProgressBar } from "../../_components/ProgressBar";
import { formatCurrency } from "@/lib/format";
import { getBudgetUsage } from "@/lib/budget-status";

/**
 * Merges what used to be two adjacent cards (Income/Saved, and the fixed
 * budget progress bar) into one — same values, same computations, just one
 * card instead of two.
 */
export function BudgetBreakdownCard({
  baseIncome,
  extraIncome,
  saved,
  spent,
  budget,
}: {
  baseIncome: number;
  extraIncome: number;
  saved: number;
  spent: number;
  budget: number;
}) {
  const usage = getBudgetUsage(spent, budget);

  return (
    <div>
      <div className="summary-row summary-row--home">
        <div className="summary-item">
          <span className="summary-label">Income</span>
          <span className="summary-value summary-value--good">
            {formatCurrency(baseIncome + extraIncome)}
          </span>
          {extraIncome > 0 && (
            <span className="summary-sub">
              {formatCurrency(baseIncome)} base + {formatCurrency(extraIncome)} extra
            </span>
          )}
        </div>
        <div className="summary-item">
          <span className="summary-label">Saved</span>
          <span className="summary-value summary-value--good">{formatCurrency(saved)}</span>
        </div>
      </div>

      <div className="card-divider">
        <div className="progress-bar-label">
          <span>Fixed budget used</span>
          <span>{usage.percentage}%</span>
        </div>
        <ProgressBar current={spent} target={budget} colorState={usage.state} />
        <p className="field-hint" style={{ marginTop: "0.5rem" }}>
          {formatCurrency(spent)} of {formatCurrency(budget)} in fixed targets
          {usage.overBy > 0 && (
            <span className="overage-text"> · {formatCurrency(usage.overBy)} over</span>
          )}
        </p>
      </div>
    </div>
  );
}
