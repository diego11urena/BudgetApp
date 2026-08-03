import { formatUSD } from "@/lib/format";
import { iconForCategoryName } from "@/lib/category-icons";
import type { CycleClosedSummary } from "../actions";

export function CycleClosedCard({
  summary,
  onDismiss,
}: {
  summary: CycleClosedSummary;
  onDismiss: () => void;
}) {
  const isOver = summary.budget.hasBudget && summary.budget.overBy > 0;
  const isPositiveRollover = summary.rolledOver >= 0;

  return (
    <div className="cycle-closed-overlay" role="dialog" aria-modal="true" aria-label="Quincena closed">
      <div className="cycle-closed-card">
        <p className="cycle-closed-emoji">🎉</p>
        <h1 className="cycle-closed-title">Quincena closed</h1>

        <div className="summary-row">
          <div className="summary-item">
            <span className="summary-label">Spent</span>
            <span className="summary-value">{formatUSD(summary.spent)}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Saved</span>
            <span className="summary-value summary-value--good">{formatUSD(summary.saved)}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Rolled over</span>
            <span
              className={`summary-value ${isPositiveRollover ? "summary-value--good" : ""}`}
            >
              {formatUSD(summary.rolledOver)}
            </span>
          </div>
        </div>

        {summary.topCategory && (
          <div className="cycle-closed-top-category">
            <span>
              {iconForCategoryName(summary.topCategory.name)} Top category: {summary.topCategory.name}
            </span>
            <span>{formatUSD(summary.topCategory.amount)}</span>
          </div>
        )}

        {summary.budget.hasBudget && (
          <div className={`banner ${isOver ? "banner--critical" : "banner--good"}`}>
            {isOver ? `Over budget by ${formatUSD(summary.budget.overBy)}` : "On budget"}
          </div>
        )}

        <button type="button" className="button cycle-closed-cta" onClick={onDismiss}>
          Start new quincena
        </button>
      </div>
    </div>
  );
}
