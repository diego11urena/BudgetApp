import type { Dictionary } from "@/lib/i18n/dictionary";

interface SummaryStatRowProps {
  income: string;
  spent: string;
  leftOver: string;
  t: Dictionary;
}

export default function SummaryStatRow({ income, spent, leftOver, t }: SummaryStatRowProps) {
  return (
    <div className="summary-stat-row">
      <div className="summary-stat">
        <div className="summary-stat-label">{t.summary.statIncome}</div>
        <div className="summary-stat-value">{income}</div>
      </div>
      <div className="summary-stat-divider" />
      <div className="summary-stat">
        <div className="summary-stat-label">{t.summary.statSpent}</div>
        <div className="summary-stat-value">{spent}</div>
      </div>
      <div className="summary-stat-divider" />
      <div className="summary-stat">
        <div className="summary-stat-label">{t.summary.statLeftOver}</div>
        <div className="summary-stat-value">{leftOver}</div>
      </div>
    </div>
  );
}
