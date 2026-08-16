"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { computeQuincenaPace } from "@/lib/quincena-pace";
import { justGotPaidAction, type CycleClosedSummary } from "../actions";
import { CycleClosedCard } from "./CycleClosedCard";
import { ConfirmJustGotPaidSheet } from "./ConfirmJustGotPaidSheet";
import { NewCycleIncomeSheet } from "./NewCycleIncomeSheet";

export function HeroCard({
  amountLeft,
  periodStart,
  totalExpenses,
  closed = false,
}: {
  amountLeft: number;
  periodStart: Date;
  totalExpenses: number;
  /** True for a past/closed cycle being viewed historically — swaps the label to "Final available," drops the days-left/per-day pace line (meaningless for a period that's already over), and hides "I just got paid" (that flow only ever closes *the* current open cycle). Defaults false so every active-cycle caller is unchanged. */
  closed?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [closedSummary, setClosedSummary] = useState<CycleClosedSummary | null>(null);
  const [showIncomePrompt, setShowIncomePrompt] = useState(false);
  // Captured synchronously on click, before either modal mounts, and reused
  // across both — the trigger button gets disabled while pending, so a
  // modal that instead re-derives document.activeElement at its own mount
  // time (rather than being handed this directly) can end up capturing
  // <body> if that mount happens to land while the button is disabled.
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);
  const isPositive = amountLeft >= 0;
  const pace = closed
    ? null
    : computeQuincenaPace({ periodStart, now: new Date(), amountLeft, totalExpenses });

  async function handleConfirmedJustGotPaid(payDate: string) {
    setConfirming(false);
    setPending(true);
    const summary = await justGotPaidAction(payDate);
    setPending(false);
    setClosedSummary(summary);
    // The new cycle exists in the DB now, even while CycleClosedCard's own
    // overlay (built from this response, not a re-fetch) is still showing —
    // refresh so the Home content underneath is already correct once the
    // overlay dismisses, instead of relying only on revalidatePath.
    router.refresh();
  }

  function handleDismissSummary() {
    setShowIncomePrompt(true);
  }

  function handleFinishIncomePrompt() {
    setShowIncomePrompt(false);
    setClosedSummary(null);
    // Catches confirmNewCycleIncomeAction's write too (NewCycleIncomeSheet,
    // the very last step of this flow).
    router.refresh();
  }

  return (
    <>
      <div className="hero-card">
        <p className="hero-label">{closed ? "Final available" : "Available to spend"}</p>
        <p className={`hero-value ${isPositive ? "hero-value--good" : "hero-value--critical"}`}>
          {formatCurrency(amountLeft)}
        </p>
        {!closed && (
          <>
            <p className="hero-subtitle">Remaining this Quincena</p>
            {pace && (
              <p className={`hero-pace ${pace.isOverPace ? "hero-pace--warning" : ""}`}>
                {pace.daysRemaining} day{pace.daysRemaining === 1 ? "" : "s"} left ·{" "}
                {pace.isLastDay ? "Last day of this quincena" : `~${formatCurrency(pace.perDay)}/day`}
              </p>
            )}
            <button
              type="button"
              className="hero-action-link"
              onClick={(e) => {
                setTriggerElement(e.currentTarget);
                setConfirming(true);
              }}
              disabled={pending}
            >
              {pending ? (
                "Closing quincena..."
              ) : (
                <>
                  I just got paid <ArrowRight size={16} aria-hidden="true" />
                </>
              )}
            </button>
          </>
        )}
      </div>

      {confirming && (
        <ConfirmJustGotPaidSheet
          onConfirm={handleConfirmedJustGotPaid}
          onCancel={() => setConfirming(false)}
          returnFocusTo={triggerElement}
        />
      )}

      {closedSummary && !showIncomePrompt && (
        <CycleClosedCard
          summary={closedSummary}
          onDismiss={handleDismissSummary}
          returnFocusTo={triggerElement}
        />
      )}

      {closedSummary && showIncomePrompt && (
        <NewCycleIncomeSheet
          initialAmount={closedSummary.carriedIncomeAmount}
          onDone={handleFinishIncomePrompt}
          returnFocusTo={triggerElement}
        />
      )}
    </>
  );
}
