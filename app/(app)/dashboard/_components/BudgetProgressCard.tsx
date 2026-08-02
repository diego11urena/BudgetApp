import { ProgressBar } from "../../_components/ProgressBar";
import { formatUSD } from "@/lib/format";

export function BudgetProgressCard({ spent, budget }: { spent: number; budget: number }) {
  const percentage = budget > 0 ? Math.round((spent / budget) * 100) : 0;

  return (
    <div>
      <div className="progress-bar-label">
        <span>Spent</span>
        <span>{percentage}%</span>
      </div>
      <ProgressBar current={spent} target={budget} />
      <p className="field-hint" style={{ marginTop: "0.5rem" }}>
        {formatUSD(spent)} / {formatUSD(budget)}
      </p>
    </div>
  );
}
