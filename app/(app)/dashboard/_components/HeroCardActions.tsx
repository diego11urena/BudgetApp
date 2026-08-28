"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronRight } from "lucide-react";
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
 *
 * variant="banner" (see PaydayOverdueBanner) renders the exact same flow
 * behind a prominent .banner--action row instead of the small inline
 * link -- a second, independent mount of this same component rather than
 * a shared/lifted state, matching how QuickAddSheet already gets
 * triggered from several independent entry points (BottomNav's FAB,
 * AddToCycleButton, TransactionList's own row-tap) instead of one global
 * instance. bannerLabel is only read when variant is "banner".
 *
 * showBanner (banner variant only) controls just the trigger button's own
 * visibility, never whether this component itself is mounted -- the
 * caller's own "should the overdue prompt show at all" condition
 * (pace.phase === "ended") is server-derived and flips the instant
 * justGotPaidAction succeeds (the very next router.refresh() inside
 * handleConfirmedJustGotPaid re-fetches it), so gating this component's
 * own mount on that condition self-destructs its confirming/closedSummary
 * state mid-flow -- CycleClosedCard would never even get a chance to
 * render. Keeping the component permanently mounted and only toggling the
 * trigger's visibility lets that local state survive the refresh, exactly
 * like the always-mounted "link" variant already does.
 */
export function HeroCardActions({
  variant = "link",
  bannerLabel,
  showBanner = true,
}: {
  variant?: "link" | "banner";
  bannerLabel?: string;
  showBanner?: boolean;
}) {
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
      {variant === "banner" ? (
        // The wrapping .dashboard-section only renders alongside the
        // button itself, together, never on its own -- an always-present
        // but EMPTY .dashboard-section (matching a generic
        // .dashboard-section selector elsewhere in this app's own e2e
        // suite before any *visible* one) hangs Playwright's own
        // waitForSelector forever on the first, invisible match.
        showBanner && (
          <div className="dashboard-section dashboard-section--plain">
            <button
              type="button"
              className="banner banner--action"
              aria-live="polite"
              onClick={(e) => {
                setTrigger(e.currentTarget);
                setConfirming(true);
              }}
              disabled={pending}
            >
              <span>{pending ? "Closing quincena..." : bannerLabel}</span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        )
      ) : (
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
      )}

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
