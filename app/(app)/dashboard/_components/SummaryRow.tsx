import { formatCurrency } from "@/lib/format";

export function SummaryRow({
  baseIncome,
  extraIncome,
  saved,
}: {
  baseIncome: number;
  extraIncome: number;
  saved: number;
}) {
  return (
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
  );
}
