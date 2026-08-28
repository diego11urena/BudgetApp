"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { justGotPaidAction, type CycleClosedSummary } from "../actions";
import { CycleClosedCard } from "./CycleClosedCard";
import { ConfirmJustGotPaidSheet } from "./ConfirmJustGotPaidSheet";
import { NewCycleIncomeSheet } from "./NewCycleIncomeSheet";
import { useToast } from "../../_components/ToastProvider";
import { useSheet } from "../../_components/useSheet";

/**
 * The one genuinely interactive slice of HeroCard -- the "I just got paid"
 * button and its three follow-on sheets. Split out so HeroCard itself can
 * be a server component: its label/value/pace text is pure display over
 * props the page already fetched server-side, with no client-only API
 * involved, so there's no reason it (and the client JS it'd otherwise drag
 * along) has to ship to every visitor on every page load.
 */
export function HeroCardActions() {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [closedSummary, setClosedSummary] = useState<CycleClosedSummary | null>(null);
  const [showIncomePrompt, setShowIncomePrompt] = useState(false);
  // Captured synchronously on click, before either modal mounts, and reused
  // across all three — the trigger button gets disabled while pending, so a
  // modal that instead re-derives document.activeElement at its own mount
  // time (rather than being handed this directly) can end up capturing
  // <body> if that mount happens to land while the button is disabled.
  const { sheetProps, setTrigger } = useSheet();

  async function handleConfirmedJustGotPaid(payDate: string) {
    setConfirming(false);
    setPending(true);
    try {
      const result = await justGotPaidAction(payDate);
      if ("error" in result) {
        showToast(result.error);
        return;
      }
      setClosedSummary(result);
      // The new cycle exists in the DB now, even while CycleClosedCard's
      // own overlay (built from this response, not a re-fetch) is still
      // showing — refresh so the Home content underneath is already
      // correct once the overlay dismisses, instead of relying only on
      // revalidatePath.
      router.refresh();
    } finally {
      setPending(false);
    }
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
      <button
        type="button"
        className="hero-action-link"
        onClick={(e) => {
          setTrigger(e.currentTarget);
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

      {confirming && (
        <ConfirmJustGotPaidSheet onConfirm={handleConfirmedJustGotPaid} onCancel={() => setConfirming(false)} {...sheetProps} />
      )}

      {closedSummary && !showIncomePrompt && (
        <CycleClosedCard summary={closedSummary} onDismiss={handleDismissSummary} {...sheetProps} />
      )}

      {closedSummary && showIncomePrompt && (
        <NewCycleIncomeSheet
          initialAmount={closedSummary.carriedIncomeAmount}
          onDone={handleFinishIncomePrompt}
          {...sheetProps}
        />
      )}
    </>
  );
}
