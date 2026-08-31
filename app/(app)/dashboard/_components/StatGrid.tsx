import { formatCurrency } from "@/lib/format";
import type { RecurringExpensesSummary } from "@/lib/recurring-expenses";

/**
 * Home's 2x2 stat grid -- replaces BudgetBreakdownCard's stacked
 * Income/Saved row + Bills progress divider (see the Balboa design
 * system handoff's Home spec, "Stat grid"). BudgetBreakdownCard itself
 * stays untouched and in use on History's closed-cycle page, which this
 * handoff doesn't cover.
 */
export function StatGrid({
  baseIncome,
  extraIncome,
  spent,
  saved,
  fundedGoalsCount,
  recurringExpenses,
}: {
  baseIncome: number;
  extraIncome: number;
  spent: number;
  saved: number;
  fundedGoalsCount: number;
  recurringExpenses: RecurringExpensesSummary;
}) {
  const totalIncome = baseIncome + extraIncome;
  const spentPercent = totalIncome > 0 ? Math.round((spent / totalIncome) * 100) : 0;
  const unpaidCount = recurringExpenses.totalCount - recurringExpenses.paidCount;

  return (
    <div className="stat-grid">
      <div className="stat-tile">
        <span className="stat-tile-label">Income</span>
        <span className="stat-tile-value stat-tile-value--good">{formatCurrency(totalIncome)}</span>
        <span className="stat-tile-sub">
          {extraIncome > 0
            ? `${formatCurrency(baseIncome)} base + ${formatCurrency(extraIncome)} extra`
            : "this quincena"}
        </span>
      </div>
      <div className="stat-tile">
        <span className="stat-tile-label">Spent</span>
        <span className="stat-tile-value">{formatCurrency(spent)}</span>
        <span className="stat-tile-sub">{spentPercent}% of income</span>
      </div>
      <div className="stat-tile">
        <span className="stat-tile-label">Saved</span>
        <span className="stat-tile-value stat-tile-value--savings">{formatCurrency(saved)}</span>
        <span className="stat-tile-sub">
          {fundedGoalsCount} goal{fundedGoalsCount === 1 ? "" : "s"} funded
        </span>
      </div>
      <div className="stat-tile">
        <span className="stat-tile-label">Bills left</span>
        <span className="stat-tile-value stat-tile-value--warning">
          {formatCurrency(recurringExpenses.pendingAmount)}
        </span>
        <span className="stat-tile-sub">
          {unpaidCount} of {recurringExpenses.totalCount} unpaid
        </span>
      </div>
    </div>
  );
}
