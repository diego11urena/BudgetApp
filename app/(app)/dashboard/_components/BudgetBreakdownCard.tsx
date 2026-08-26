import { formatCurrency } from "@/lib/format";
import type { RecurringExpensesSummary } from "@/lib/recurring-expenses";

/**
 * Merges what used to be two adjacent cards (Income/Saved, and the fixed
 * budget progress bar) into one — same values, same computations, just one
 * card instead of two.
 *
 * The recurring-expenses section used to show "$X of $Y in fixed targets"
 * (X = every transaction posted to any category with a recurring-expense
 * budget, Y = the sum of those budgets) — a genuinely different number
 * from what /budget's own category rows showed for the exact same cycle
 * (actual spend *linked* to a specific recurring expense, never just
 * "posted to the category"). A paid-count, sourced from the same
 * RecurringExpensesSummary /budget itself is built from, can't disagree
 * with it the way two independent dollar totals could.
 */
export function BudgetBreakdownCard({
  baseIncome,
  extraIncome,
  saved,
  recurringExpenses,
}: {
  baseIncome: number;
  extraIncome: number;
  saved: number;
  recurringExpenses: RecurringExpensesSummary;
}) {
  return (
    <div>
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

      {recurringExpenses.totalCount > 0 && (
        <div className="card-divider">
          <div className="progress-bar-label">
            <span>Recurring expenses</span>
            <span>
              {recurringExpenses.paidCount} of {recurringExpenses.totalCount} paid
            </span>
          </div>
          {recurringExpenses.pendingAmount > 0 && (
            <p className="field-hint" style={{ marginTop: "0.5rem" }}>
              {formatCurrency(recurringExpenses.pendingAmount)} pending
            </p>
          )}
        </div>
      )}
    </div>
  );
}
