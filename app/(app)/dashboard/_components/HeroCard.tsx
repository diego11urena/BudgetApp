import { formatCurrency, formatFriendlyDate } from "@/lib/format";
import { computeCyclePace, type BudgetFrequency } from "@/lib/quincena-pace";
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
  pendingBills = 0,
  budgetFrequency,
}: {
  amountLeft: number;
  periodStart: Date;
  /** Only ever set once a cycle is closed -- null for the active cycle, in which case computeCyclePace derives the nominal end from the calendar instead. Passed through so an edited pay date (which sets this) can't disagree with the days-remaining/pace line below it. */
  periodEnd?: Date | null;
  totalExpenses: number;
  /** True for a past/closed cycle being viewed historically — swaps the label to "Final available," drops the days-left/per-day pace line (meaningless for a period that's already over), and hides "I just got paid" (that flow only ever closes *the* current open cycle). Defaults false so every active-cycle caller is unchanged. */
  closed?: boolean;
  /** Sum of (targetAmount - actual), floored at 0, across this cycle's still-unpaid bills -- e.g. RecurringExpensesSummary.pendingAmount. Subtracted from amountLeft for the headline number (see below); defaults 0 (no adjustment) for callers that don't have it, e.g. History's closed-cycle view, where "safety margin" isn't a meaningful concept for a period that's already over. */
  pendingBills?: number;
  /** The user's own pay-cadence setting -- only matters when periodEnd is null (an open cycle), where it decides whether the nominal end is derived via the ~15-day quincena formula or the ~30-day month one. A closed cycle's real periodEnd makes this irrelevant, but every caller passes it regardless so this component never has to guess. */
  budgetFrequency: BudgetFrequency;
}) {
  const dict = getDictionary(await getRequestLocale());
  const t = dict.dashboard;
  const vocab = resolveVocab(dict, budgetFrequency);
  // The hero number used to be raw amountLeft -- money that still includes
  // whatever's sitting in unpaid bills (e.g. rent not paid yet). That reads
  // as more spendable than it really is, and worst in the first half of
  // every quincena, exactly when someone is most likely to overspend. This
  // reserves unpaid bills off the headline instead, so the big number is
  // never more optimistic than reality. See the Balboa fix list's batch
  // 11.5, decision 1.
  const safeToSpend = closed ? amountLeft : amountLeft - pendingBills;
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
      {!closed && pendingBills > 0 && (
        <p className="hero-subtitle">
          {t.heroAvailableSummary(formatCurrency(amountLeft), formatCurrency(pendingBills))}
        </p>
      )}
      {!closed && pace && (
        <>
          {/* Cycle-elapsed progress bar -- new: previously this same
              "how far through the quincena am I" fact only existed as text
              (the days-left half of hero-pace below), never a visual bar. */}
          {pace.phase !== "ended" && (
            <div className="hero-elapsed-row">
              <div className="hero-elapsed-track">
                <div className="hero-elapsed-fill" style={{ width: `${pace.elapsedFraction * 100}%` }} />
              </div>
              <span className="hero-elapsed-label">{t.heroDaysLeft(pace.daysRemaining)}</span>
            </div>
          )}
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
          <div className="hero-pace-row">
            <p className="hero-pace">
              {pace.phase === "running" && t.heroPacePerDay(formatCurrency(pace.perDay))}
              {pace.phase === "last-day" && t.heroLastDay(formatCurrency(safeToSpend))}
              {pace.phase === "ended" && t.heroCycleEnded(vocab, formatFriendlyDate(pace.cycleEnd))}
            </p>
            <HeroCardActions />
          </div>
        </>
      )}
    </div>
  );
}
