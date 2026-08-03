import { ProgressBar } from "../../_components/ProgressBar";
import { formatUSD } from "@/lib/format";
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
        {formatUSD(spent)} / {formatUSD(budget)}
        {usage.overBy > 0 && <span className="overage-text"> · {formatUSD(usage.overBy)} over</span>}
      </p>
    </div>
  );
}
