import type { Dictionary } from "@/lib/i18n/dictionary";

interface SummaryStatRowProps {
  income: string;
  spent: string;
  saved: string;
  t: Dictionary;
}

/**
 * Income · Spent · Saved (gold) -- no Leftover row here. That word moved
 * to Breakdown's Cash-flow chapter (and the Monthly Close sheet) per the
 * design spec; Summary's own stat row now mirrors chapter 01's third
 * segment instead of a fourth number this row never had room to show
 * anyway (three stats, not four). Saved reuses the root-level t.statSaved
 * key (t.dashboard.statSaved) -- the exact same word Home's StatGrid and
 * BudgetBreakdownCard already use, so "Saved" never has two different
 * spellings/labels depending which screen you're on.
 */
export default function SummaryStatRow({ income, spent, saved, t }: SummaryStatRowProps) {
  return (
    <div className="summary-stat-row">
      <div className="summary-stat">
        <div className="summary-stat-label">{t.summary.statIncome}</div>
        <div className="summary-stat-value summary-stat-value--income">{income}</div>
      </div>
      <div className="summary-stat-divider" />
      <div className="summary-stat">
        <div className="summary-stat-label">{t.summary.statSpent}</div>
        <div className="summary-stat-value">{spent}</div>
      </div>
      <div className="summary-stat-divider" />
      <div className="summary-stat">
        <div className="summary-stat-label">{t.dashboard.statSaved}</div>
        <div className="summary-stat-value summary-stat-value--saved">{saved}</div>
      </div>
    </div>
  );
}
