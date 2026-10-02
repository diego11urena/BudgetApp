import { formatCurrency } from "@/lib/format";
import type { RecurringExpensesSummary } from "@/lib/recurring-expenses";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary, resolveVocab } from "@/lib/i18n/get-dictionary";
import type { BudgetFrequency } from "@/lib/quincena-pace";

/**
 * Home's 2x2 stat grid -- replaces BudgetBreakdownCard's stacked
 * Income/Saved row + Scheduled-recurring progress divider (see the Balboa
 * design system handoff's Home spec, "Stat grid"). BudgetBreakdownCard
 * itself stays untouched and in use on History's closed-cycle page, which
 * this handoff doesn't cover. recurringExpenses here is Scheduled-only
 * (see RecurringExpensesSummary's own doc comment) -- Ongoing items never
 * factor into this tile.
 */
export async function StatGrid({
  baseIncome,
  paycheckCount,
  expectedPaychecks,
  firstPaycheckDate,
  extraIncome,
  spent,
  saved,
  fundedGoalsCount,
  recurringExpenses,
  budgetFrequency,
}: {
  baseIncome: number;
  /** Paychecks actually logged into this cycle. */
  paycheckCount: number;
  /** Paychecks this cycle expects -- 2 only for a monthly budget on twice-monthly pay (lib/paycheck-schedule.ts). */
  expectedPaychecks: number;
  /** The cycle's start, for the single-paycheck sub-line's date. */
  firstPaycheckDate: string;
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
        {/* What this sub-line should say depends on how many paychecks
            the cycle expects. With more than one it tracks progress
            through them ("Paycheck 1 of 2" -> "2 of 2 paychecks"), which
            is the whole reason a monthly budgeter looks at this tile
            mid-month. With exactly one there is no progress to report, so
            it names the day it arrived instead. Extra income still wins
            over both -- it is the only case where the figure above is a
            sum of two different things and needs breaking down. */}
        <span className="stat-tile-sub">
          {extraIncome > 0
            ? t.baseExtra(formatCurrency(baseIncome), formatCurrency(extraIncome))
            : expectedPaychecks > 1
              ? paycheckCount >= expectedPaychecks
                ? t.statPaychecksAllIn(expectedPaychecks)
                : t.statPaycheckOf(paycheckCount, expectedPaychecks)
              : paycheckCount > 0
                ? t.statSinglePaycheck(firstPaycheckDate)
                : t.thisQuincena(vocab)}
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
        <span className="stat-tile-label">{t.statScheduledLeft}</span>
        <span className="stat-tile-value stat-tile-value--recurring">
          {formatCurrency(recurringExpenses.pendingAmount)}
        </span>
        <span className="stat-tile-sub">{t.scheduledUnpaid(unpaidCount, recurringExpenses.totalCount)}</span>
      </div>
    </div>
  );
}
