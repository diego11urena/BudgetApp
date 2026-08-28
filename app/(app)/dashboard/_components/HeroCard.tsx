import { formatCurrency, formatFriendlyDate } from "@/lib/format";
import { computeQuincenaPace } from "@/lib/quincena-pace";
import { HeroCardActions } from "./HeroCardActions";

/**
 * Server component -- the label/value/pace text below is pure display over
 * props the page already fetched, with no client-only API involved. Only
 * the "I just got paid" flow (HeroCardActions) needs a client boundary; see
 * its own doc comment for why that split is worth it here specifically
 * (this card renders on every Home/History-detail load).
 */
export function HeroCard({
  amountLeft,
  periodStart,
  periodEnd = null,
  totalExpenses,
  closed = false,
  pendingBills = 0,
}: {
  amountLeft: number;
  periodStart: Date;
  /** Only ever set once a cycle is closed -- null for the active cycle, in which case computeQuincenaPace derives the nominal end from the calendar instead. Passed through so an edited pay date (which sets this) can't disagree with the days-remaining/pace line below it. */
  periodEnd?: Date | null;
  totalExpenses: number;
  /** True for a past/closed cycle being viewed historically — swaps the label to "Final available," drops the days-left/per-day pace line (meaningless for a period that's already over), and hides "I just got paid" (that flow only ever closes *the* current open cycle). Defaults false so every active-cycle caller is unchanged. */
  closed?: boolean;
  /** Sum of (targetAmount - actual), floored at 0, across this cycle's still-unpaid bills -- e.g. RecurringExpensesSummary.pendingAmount. Subtracted from amountLeft for the headline number (see below); defaults 0 (no adjustment) for callers that don't have it, e.g. History's closed-cycle view, where "safety margin" isn't a meaningful concept for a period that's already over. */
  pendingBills?: number;
}) {
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
    : computeQuincenaPace({ periodStart, periodEnd, now: new Date(), amountLeft: safeToSpend, totalExpenses });

  return (
    <div className="hero-card">
      <p className="hero-label">{closed ? "Final available" : "Safe to spend"}</p>
      <p className={`hero-value ${isPositive ? "hero-value--good" : "hero-value--critical"}`}>
        {formatCurrency(safeToSpend)}
      </p>
      {!closed && pendingBills > 0 && (
        <p className="hero-subtitle">
          {formatCurrency(amountLeft)} available before {formatCurrency(pendingBills)} in unpaid bills
        </p>
      )}
      {!closed && (
        <>
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
          {pace && (
            <p className="hero-pace">
              {pace.phase === "running" &&
                `${pace.daysRemaining} days left · ~${formatCurrency(pace.perDay)}/day`}
              {pace.phase === "last-day" && `Last day · ${formatCurrency(safeToSpend)} to spend`}
              {pace.phase === "ended" &&
                `Quincena ended ${formatFriendlyDate(pace.cycleEnd)} · tap "I just got paid"`}
            </p>
          )}
          <HeroCardActions />
        </>
      )}
    </div>
  );
}
