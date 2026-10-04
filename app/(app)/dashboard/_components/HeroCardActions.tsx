"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { justGotPaidAction, rolloverMonthlyCycleAction } from "../actions";
import { ConfirmJustGotPaidSheet } from "./ConfirmJustGotPaidSheet";
import { LogPaycheckSheet } from "./LogPaycheckSheet";
import { useToast } from "../../_components/ToastProvider";
import { useSheet } from "../../_components/useSheet";
import { useT, useVocab, useBudgetFrequency } from "@/app/_components/LocaleProvider";

/**
 * The one genuinely interactive slice of HeroCard -- the "I just got paid"
 * button(s) and their follow-on sheets. Split out so HeroCard itself can
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
 *
 * MONTHLY budgets never auto-detect an overdue cycle (dashboard/page.tsx
 * always passes showBanner={false} to the banner-variant mount for a
 * MONTHLY account -- see PaydayOverdueBanner's caller), so the banner
 * variant below is QUINCENAL-only in practice; the link variant is where
 * MONTHLY's two explicit actions -- "I just got paid" (logs a paycheck
 * additively, never closes) and "Close this month" (closes, never asks
 * for a paycheck amount) -- both live, side by side, always available,
 * matching the "manual only, no auto-nudge" design for MONTHLY rollover.
 */
export function HeroCardActions({
  variant = "link",
  bannerLabel,
  showBanner = true,
  allPaychecksIn = false,
  namesPeriod = false,
  periodName,
  paycheckCount = 0,
  expectedPaychecks = 1,
  usualPaycheck = 0,
  currentIncome = 0,
  closeKicker,
  closeSummaryRows,
}: {
  variant?: "link" | "banner";
  bannerLabel?: string;
  showBanner?: boolean;
  /**
   * MONTHLY only: every paycheck this cycle expects has been logged, so
   * "I just got paid" has nothing left to add and drops away, leaving
   * closing as the single action. See lib/paycheck-schedule.ts.
   */
  allPaychecksIn?: boolean;
  /**
   * Whether the single close action should name the period it closes.
   * True only once a cycle that EXPECTED more than one paycheck has them
   * all in -- that is a moment ("September is complete, close it"). A
   * once-a-month earner is in the single-action state from day one, where
   * "Close September" on the 2nd would read as a prompt rather than a
   * statement of fact, so they keep the generic label.
   */
  namesPeriod?: boolean;
  /** MONTHLY only: the period's own name, for the single-action label ("Close September"). */
  periodName?: string;
  /** Paychecks already logged -- the paycheck sheet's kicker counts from this. */
  paycheckCount?: number;
  expectedPaychecks?: number;
  /** The user's usual paycheck amount, prefilled into the sheet. */
  usualPaycheck?: number;
  /** Income already in this cycle, for the sheet's before/after preview. */
  currentIncome?: number;
  /** The close sheet's kicker ("Oct 1 - Oct 31 · Day 13 of 31"). */
  closeKicker?: string;
  /** The close sheet's income/spent/saved/leftover rows. */
  closeSummaryRows?: Array<{ label: string; value: string; tone?: "saved" | "income" }>;
}) {
  const t = useT().dashboard;
  const vocab = useVocab();
  const budgetFrequency = useBudgetFrequency();
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // MONTHLY's "I just got paid" -- a separate, independent flow from the
  // confirming/closedSummary state above, since logging a paycheck never
  // closes anything (no CycleClosedCard, no income-prompt follow-up).
  const [showLogPaycheck, setShowLogPaycheck] = useState(false);
  // Captured synchronously on click, before any modal mounts, and reused
  // across all of them — the trigger button gets disabled while pending, so a
  // modal that instead re-derives document.activeElement at its own mount
  // time (rather than being handed this directly) can end up capturing
  // <body> if that mount happens to land while the button is disabled.
  const { sheetProps, setTrigger } = useSheet();

  const isMonthly = budgetFrequency === "MONTHLY";

  async function handleConfirmedJustGotPaid(payDate: string) {
    setConfirming(false);
    setPending(true);
    try {
      // QUINCENAL: closes and seeds the new cycle's income from the
      // account's IncomeSource. MONTHLY's "Close this month" closes without
      // touching income at all -- paychecks were already logged individually
      // via logPaycheckAction, so there's nothing to seed or confirm.
      const result = isMonthly ? await rolloverMonthlyCycleAction(payDate) : await justGotPaidAction(payDate);
      if ("error" in result) {
        showToast(result.error);
        return;
      }
      // Straight to the Summary screen for the cycle that just closed --
      // the redesign replaced the old CycleClosedCard modal with a real
      // page, and this is where that flow lands now. refresh() first so
      // Home is already up to date behind it (a back-navigation from
      // Summary shouldn't show the cycle that just closed as still open).
      router.refresh();
      router.push(`/dashboard/summary/${result.closedCycleId}`);
    } finally {
      setPending(false);
    }
  }

  function handleFinishLogPaycheck() {
    setShowLogPaycheck(false);
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
              <span className="banner-dot" aria-hidden="true" />
              <span>{pending ? t.closingQuincena(vocab) : bannerLabel}</span>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        )
      ) : isMonthly ? (
        // Two actions while a paycheck is still outstanding; one once they
        // are all in. The close button also changes what it says: beside
        // "I just got paid" it is the generic "Close this cycle", but
        // standing alone it names the month it closes, which is the only
        // moment there is room for that and the only moment it is the
        // user's single remaining move.
        <div className={`hero-actions${allPaychecksIn ? " hero-actions--single" : ""}`}>
          {!allPaychecksIn && (
            <button
              type="button"
              className="hero-action-link"
              onClick={(e) => {
                setTrigger(e.currentTarget);
                setShowLogPaycheck(true);
              }}
            >
              {t.iJustGotPaid}
            </button>
          )}
          <button
            type="button"
            // Outlined except in the one state that is a completed
            // month awaiting its close -- there the filled pill is the
            // single thing the card is asking for.
            className={`hero-action-link${namesPeriod ? "" : " hero-action-link--outlined"}`}
            onClick={(e) => {
              setTrigger(e.currentTarget);
              setConfirming(true);
            }}
            disabled={pending}
          >
            {pending
              ? t.closeMonth.pending
              : namesPeriod && periodName
                ? t.heroClosePeriod(periodName)
                : t.heroCloseCycle}
          </button>
        </div>
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
            t.closingQuincena(vocab)
          ) : (
t.iJustGotPaid
          )}
        </button>
      )}

      {confirming && (
        <ConfirmJustGotPaidSheet
          onConfirm={handleConfirmedJustGotPaid}
          onCancel={() => setConfirming(false)}
          {...(isMonthly
            ? {
                kicker: closeKicker,
                title: periodName ? t.closeMonth.titleNamed(periodName) : t.closeMonth.title,
                body: t.closeMonth.body,
                summaryRows: closeSummaryRows,
                // Only when a paycheck the cycle expected never arrived --
                // closing then would freeze the month short of its real
                // income, which is the one mistake this sheet can prevent.
                warning: allPaychecksIn
                  ? null
                  : {
                      text: t.closeMonth.missingPaycheck,
                      actionLabel: t.closeMonth.missingPaycheckAction,
                      onAction: () => {
                        setConfirming(false);
                        setShowLogPaycheck(true);
                      },
                    },
                whenLabel: t.closeMonth.whenEnded,
                confirmLabel: periodName ? t.heroClosePeriod(periodName) : t.closeMonth.yes,
                cancelLabel: t.closeMonth.cancel,
              }
            : {})}
          {...sheetProps}
        />
      )}

      {showLogPaycheck && (
        <LogPaycheckSheet
          onDone={handleFinishLogPaycheck}
          onCancel={() => setShowLogPaycheck(false)}
          paycheckNumber={paycheckCount + 1}
          expectedPaychecks={expectedPaychecks}
          usualAmount={usualPaycheck}
          currentIncome={currentIncome}
          periodName={periodName ?? ""}
          {...sheetProps}
        />
      )}
    </>
  );
}
