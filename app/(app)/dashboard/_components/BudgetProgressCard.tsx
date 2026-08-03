import { ProgressBar } from "../../_components/ProgressBar";
import { formatCurrency } from "@/lib/format";
import { getBudgetUsage } from "@/lib/budget-status";

export function BudgetProgressCard({ spent, budget }: { spent: number; budget: number }) {
  const usage = getBudgetUsage(spent, budget);

  return (
    <div>
      <div className="progress-bar-label">
        <span>Spent</span>
        <span>{usage.percentage}%</span>
      </div>
      <ProgressBar current={spent} target={budget} colorState={usage.state} />
      <p className="field-hint" style={{ marginTop: "0.5rem" }}>
        {formatCurrency(spent)} / {formatCurrency(budget)}
        {usage.overBy > 0 && <span className="overage-text"> · {formatCurrency(usage.overBy)} over</span>}
      </p>
    </div>
  );
}
