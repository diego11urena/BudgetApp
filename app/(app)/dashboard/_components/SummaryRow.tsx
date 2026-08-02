import { formatUSD } from "@/lib/format";

export function SummaryRow({
  income,
  expenses,
  saved,
}: {
  income: number;
  expenses: number;
  saved: number;
}) {
  return (
    <div className="summary-row">
      <div className="summary-item">
        <span className="summary-label">Income</span>
        <span className="summary-value summary-value--good">{formatUSD(income)}</span>
      </div>
      <div className="summary-item">
        <span className="summary-label">Expenses</span>
        <span className="summary-value">{formatUSD(expenses)}</span>
      </div>
      <div className="summary-item">
        <span className="summary-label">Saved</span>
        <span className="summary-value summary-value--good">{formatUSD(saved)}</span>
      </div>
    </div>
  );
}
