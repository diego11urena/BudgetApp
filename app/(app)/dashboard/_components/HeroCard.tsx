import { Check } from "lucide-react";
import { formatCurrency, formatFriendlyDate } from "@/lib/format";
import { computeCyclePace, cycleLengthDays, type BudgetFrequency } from "@/lib/quincena-pace";
import { HeroCardActions } from "./HeroCardActions";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary, resolveVocab } from "@/lib/i18n/get-dictionary";

/**
 * Server component -- the label/value/pace text below is pure display over
 * props the page already fetched, with no client-only API involved. Only
 * the "I just got paid" flow (HeroCardActions) needs a client boundary; see
 * its own doc comment for why that split is worth it here specifically
 * (this card renders on every Home/History-detail load).
 */
export async function HeroCard({
  amountLeft,
  periodStart,
  periodEnd = null,
  totalExpenses,
  closed = false,
  pendingScheduled = 0,
  budgetFrequency,
  secondPaycheckInDays = null,
  allPaychecksIn = false,
  expectedPaychecks = 1,
  paycheckCount = 0,
  usualPaycheck = 0,
  extraIncome = 0,
  totalSavings = 0,
  dateRangeLabel = "",
  periodName,
  baseIncome = 0,
}: {
  amountLeft: number;
  periodStart: Date;
  /** Only ever set once a cycle is closed -- null for the active cycle, in which case computeCyclePace derives the nominal end from the calendar instead. Passed through so an edited pay date (which sets this) can't disagree with the days-remaining/pace line below it. */
  periodEnd?: Date | null;
  totalExpenses: number;
  /** True for a past/closed cycle being viewed historically — swaps the label to "Final available," drops the days-left/per-day pace line (meaningless for a period that's already over), and hides "I just got paid" (that flow only ever closes *the* current open cycle). Defaults false so every active-cycle caller is unchanged. */
  closed?: boolean;
  /** Sum of (targetAmount - actual), floored at 0, across this cycle's still-unpaid Scheduled recurring expenses only -- e.g. RecurringExpensesSummary.pendingAmount. Ongoing recurring expenses (no fixed date, an estimated amount) never contribute here (confirmed design decision -- see summarizeRecurringExpenses's own doc comment). Subtracted from amountLeft for the headline number (see below); defaults 0 (no adjustment) for callers that don't have it, e.g. History's closed-cycle view, where "safety margin" isn't a meaningful concept for a period that's already over. */
  pendingScheduled?: number;
  /** The user's own pay-cadence setting -- only matters when periodEnd is null (an open cycle), where it decides whether the nominal end is derived via the ~15-day quincena formula or the ~30-day month one. A closed cycle's real periodEnd makes this irrelevant, but every caller passes it regardless so this component never has to guess. */
  budgetFrequency: BudgetFrequency;
  /** MONTHLY + twice-monthly pay, second paycheck still outstanding: days until it's expected. Null otherwise (see lib/paycheck-schedule.ts). */
  secondPaycheckInDays?: number | null;
  /** Every paycheck this cycle expects has been logged -- swaps the pace line for a confirmation and leaves closing as the single action. */
  allPaychecksIn?: boolean;
  /** How many paychecks this cycle expects (lib/paycheck-schedule.ts). Separates "a completed two-paycheck month" from "a once-a-month earner, who is in the single-action state all month". */
  expectedPaychecks?: number;
  /** Paychecks already logged into this cycle. */
  paycheckCount?: number;
  /** The user's usual paycheck amount, prefilled into the log-paycheck sheet. */
  usualPaycheck?: number;
  /** One-off income this cycle, for the close sheet's Income row. */
  extraIncome?: number;
  /** Savings contributions this cycle, for the close sheet's Saved row. */
  totalSavings?: number;
  /** "Oct 1 - Oct 31", for the close sheet's kicker. */
  dateRangeLabel?: string;
  /** The period's own name, for the single-action "Close September" label. */
  periodName?: string;
  /** Sum of the cycle's logged paychecks, shown in the all-in confirmation line. */
  baseIncome?: number;
}) {
  const dict = getDictionary(await getRequestLocale());
  const t = dict.dashboard;
  const vocab = resolveVocab(dict, budgetFrequency);
  // The hero number used to be raw amountLeft -- money that still includes
  // whatever's sitting in unpaid Scheduled recurring expenses (e.g. rent
  // not paid yet). That reads as more spendable than it really is, and
  // worst in the first half of every quincena, exactly when someone is
  // most likely to overspend. This reserves those unpaid amounts off the
  // headline instead, so the big number is never more optimistic than
  // reality. See the Balboa fix list's batch 11.5, decision 1.
  const safeToSpend = closed ? amountLeft : amountLeft - pendingScheduled;
  const isMonthly = budgetFrequency === "MONTHLY";
  // The completed-month state: a cycle that expected more than one
  // paycheck and now has them all. A once-a-month earner never reaches
  // it -- they have exactly one paycheck from the start, so there is no
  // "both are in" to announce and nothing about the month is newly
  // complete.
  const monthComplete = isMonthly && expectedPaychecks > 1 && allPaychecksIn;
  // "Day 13 of 31" for the close sheet's kicker. QuincenaPace reports days
  // REMAINING, so the elapsed count is derived rather than read -- +1
  // because the first day of a cycle is day 1, not day 0.
  const totalDays = cycleLengthDays(periodStart, budgetFrequency);
  const isPositive = safeToSpend >= 0;
  const pace = closed
    ? null
    : computeCyclePace({
        periodStart,
        periodEnd,
        now: new Date(),
        amountLeft: safeToSpend,
        totalExpenses,
        frequency: budgetFrequency,
      });

  return (
    <div className="hero-card">
      <p className="hero-label">{closed ? t.heroFinalAvailable : t.heroSafeToSpend}</p>
      <p className={`hero-value ${isPositive ? "hero-value--good" : "hero-value--critical"}`}>
        {formatCurrency(safeToSpend)}
      </p>
      {!closed && pendingScheduled > 0 && (
        <p className="hero-subtitle">
          {t.heroAvailableSummary(formatCurrency(amountLeft), formatCurrency(pendingScheduled))}
        </p>
      )}
      {!closed && pace && (
        <>
          {/* Cycle-elapsed progress bar -- new: previously this same
              "how far through the quincena am I" fact only existed as text
              (the days-left half of hero-pace below), never a visual bar. */}
          {/* The bar stays on once the period has ended rather than
              disappearing -- a full bar reading "Month ended" is the
              clearest statement that there is no runway left, where
              removing it just makes the card look unfinished. */}
          <div className="hero-elapsed-row">
            <div className="hero-elapsed-track">
              <div
                className="hero-elapsed-fill"
                style={{ width: `${(pace.phase === "ended" ? 1 : pace.elapsedFraction) * 100}%` }}
              />
            </div>
            <span className="hero-elapsed-label">
              {pace.phase === "ended" ? t.heroPeriodEnded(vocab) : t.heroDaysLeft(pace.daysRemaining)}
            </span>
          </div>
          {/* No separate subtitle line -- "Remaining this Quincena" used to
              sit here, restating exactly what the pace line below already
              says, with a number ("N days left"), better. Always the hero
              card's plain on-accent white, deterministically -- this used
              to switch to --color-warning-on-dark (gold) when the user's
              spend pace was running hot, which read as inconsistent since
              it depended on each user's own numbers. The gold "over pace"
              signal was a deliberate design choice, but the user asked for
              this line to just always be white, so isOverPace is no
              longer read into the class list here. */}
          {/* Once every expected paycheck is in, the pace line gives way
              to a confirmation of that fact -- at which point "how fast am
              I spending" matters less than "nothing more is coming, here
              is the whole month's income". */}
          {/* Quincenal keeps the pace line and its single action on one
              row -- there's one short label and room for both. Monthly
              stacks them: its pace line carries the paycheck countdown
              too, and its actions are full-width, so side by side would
              crush both. */}
          <div className={`hero-pace-row${isMonthly ? " hero-pace-row--stacked" : ""}`}>
            {monthComplete ? (
              <p className="hero-paychecks-in">
                <Check size={16} aria-hidden="true" />
                {t.heroBothPaychecksIn(formatCurrency(baseIncome))}
              </p>
            ) : (
              <p className="hero-pace">
                {pace.phase === "running" && t.heroPacePerDay(formatCurrency(pace.perDay))}
                {pace.phase === "last-day" && t.heroLastDay(formatCurrency(safeToSpend))}
                {pace.phase === "ended" && t.heroCycleEnded(vocab, formatFriendlyDate(pace.cycleEnd))}
                {secondPaycheckInDays !== null && pace.phase === "running" && (
                  <> · {t.heroSecondPaycheckIn(secondPaycheckInDays)}</>
                )}
              </p>
            )}
            <HeroCardActions
              allPaychecksIn={allPaychecksIn}
              namesPeriod={monthComplete}
              periodName={periodName}
              paycheckCount={paycheckCount}
              expectedPaychecks={expectedPaychecks}
              usualPaycheck={usualPaycheck}
              currentIncome={baseIncome}
              closeKicker={t.closeMonth.kicker(
                dateRangeLabel,
                Math.min(totalDays, totalDays - pace.daysRemaining + 1),
                totalDays,
              )}
              closeSummaryRows={[
                { label: t.closeMonth.rowIncome, value: formatCurrency(baseIncome + extraIncome) },
                { label: t.closeMonth.rowSpent, value: formatCurrency(totalExpenses) },
                { label: t.closeMonth.rowSaved, value: formatCurrency(totalSavings), tone: "saved" as const },
                { label: t.closeMonth.rowLeftover, value: formatCurrency(Math.max(0, amountLeft)) },
              ]}
            />
          </div>
        </>
      )}
    </div>
  );
}
