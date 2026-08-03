import { formatCurrency } from "@/lib/format";

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
    <div className="summary-row summary-row--home">
      <div className="summary-item">
        <span className="summary-label">Income</span>
        <span className="summary-value summary-value--good">{formatCurrency(income)}</span>
      </div>
      <div className="summary-item">
        <span className="summary-label">Expenses</span>
        <span className="summary-value">{formatCurrency(expenses)}</span>
      </div>
      <div className="summary-item">
        <span className="summary-label">Saved</span>
        <span className="summary-value summary-value--good">{formatCurrency(saved)}</span>
      </div>
    </div>
  );
}
