import { formatCurrency } from "@/lib/format";
import type { RecurringExpensesSummary } from "@/lib/recurring-expenses";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary, resolveVocab } from "@/lib/i18n/get-dictionary";
import type { BudgetFrequency } from "@/lib/quincena-pace";

/**
 * Home's 2x2 stat grid -- replaces BudgetBreakdownCard's stacked
 * Income/Saved row + Bills progress divider (see the Balboa design
 * system handoff's Home spec, "Stat grid"). BudgetBreakdownCard itself
 * stays untouched and in use on History's closed-cycle page, which this
 * handoff doesn't cover.
 */
export async function StatGrid({
  baseIncome,
  extraIncome,
  spent,
  saved,
  fundedGoalsCount,
  recurringExpenses,
  budgetFrequency,
}: {
  baseIncome: number;
  extraIncome: number;
  spent: number;
  saved: number;
  fundedGoalsCount: number;
  recurringExpenses: RecurringExpensesSummary;
  budgetFrequency: BudgetFrequency;
}) {
  const dict = getDictionary(await getRequestLocale());
  const t = dict.dashboard;
  const vocab = resolveVocab(dict, budgetFrequency);
  const totalIncome = baseIncome + extraIncome;
  const spentPercent = totalIncome > 0 ? Math.round((spent / totalIncome) * 100) : 0;
  const unpaidCount = recurringExpenses.totalCount - recurringExpenses.paidCount;

  return (
    <div className="stat-grid">
      <div className="stat-tile">
        <span className="stat-tile-label">{t.statIncome}</span>
        <span className="stat-tile-value stat-tile-value--good">{formatCurrency(totalIncome)}</span>
        <span className="stat-tile-sub">
          {extraIncome > 0 ? t.baseExtra(formatCurrency(baseIncome), formatCurrency(extraIncome)) : t.thisQuincena(vocab)}
        </span>
      </div>
      <div className="stat-tile">
        <span className="stat-tile-label">{t.statSpent}</span>
        <span className="stat-tile-value">{formatCurrency(spent)}</span>
        <span className="stat-tile-sub">{t.percentOfIncome(spentPercent)}</span>
      </div>
      <div className="stat-tile">
        <span className="stat-tile-label">{t.statSaved}</span>
        <span className="stat-tile-value stat-tile-value--savings">{formatCurrency(saved)}</span>
        <span className="stat-tile-sub">{t.goalsFunded(fundedGoalsCount)}</span>
      </div>
      <div className="stat-tile">
        <span className="stat-tile-label">{t.statBillsLeft}</span>
        <span className="stat-tile-value stat-tile-value--warning">
          {formatCurrency(recurringExpenses.pendingAmount)}
        </span>
        <span className="stat-tile-sub">{t.billsUnpaid(unpaidCount, recurringExpenses.totalCount)}</span>
      </div>
    </div>
  );
}
