import { formatUSD } from "@/lib/format";

export function AmountLeftCard({
  amountLeft,
  baseIncome,
  extraIncome,
  totalExpenses,
  totalSavings,
}: {
  amountLeft: number;
  baseIncome: number;
  extraIncome: number;
  totalExpenses: number;
  totalSavings: number;
}) {
  const isPositive = amountLeft >= 0;

  return (
    <div className="kpi-tile">
      <span className="field-hint">Amount left this cycle</span>
      <div className={`kpi-value ${isPositive ? "kpi-value--good" : "kpi-value--critical"}`}>
        {formatUSD(amountLeft)}
      </div>
      <p className="field-hint">
        {isPositive
          ? "You have this much left to spend or save this cycle."
          : "You're over this cycle's income — expenses and savings add up to more than you've brought in."}
      </p>
      <div className="kpi-breakdown">
        <div className="kpi-breakdown-item">
          <span>Paycheck income</span>
          <span>{formatUSD(baseIncome)}</span>
        </div>
        <div className="kpi-breakdown-item">
          <span>Extra income</span>
          <span>+{formatUSD(extraIncome)}</span>
        </div>
        <div className="kpi-breakdown-item">
          <span>Expenses</span>
          <span>-{formatUSD(totalExpenses)}</span>
        </div>
        <div className="kpi-breakdown-item">
          <span>Savings</span>
          <span>-{formatUSD(totalSavings)}</span>
        </div>
      </div>
    </div>
  );
}
