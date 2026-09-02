"use client";

import { EditPayInfoSheet } from "./EditPayInfoSheet";
import { useSheet } from "../../_components/useSheet";
import { useT } from "@/app/_components/LocaleProvider";

/**
 * Plain-text "Edit" trigger for correcting a quincena's already-recorded
 * pay amount/date — separate from "I just got paid" (HeroCard), which
 * always starts a new cycle instead of correcting the current one. Also
 * used on a past cycle's own page (via cycleId), where it corrects that
 * specific closed cycle instead of the current draft one.
 */
export function EditPayInfoButton({
  currentAmount,
  currentPayDate,
  cycleId,
  closed = false,
  previousBoundDate = null,
  nextBoundDate = null,
  className = "home-header-edit-link",
}: {
  currentAmount: number;
  /** "YYYY-MM-DD" — the cycle's periodStart. */
  currentPayDate: string;
  /** Present -> edits this specific cycle instead of the current draft one. */
  cycleId?: string;
  /** True for a closed cycle — swaps the "today" date ceiling for one bounded by this cycle's own next neighbor, since only the draft cycle has no neighbor after it. */
  closed?: boolean;
  /** "YYYY-MM-DD", exclusive — the earliest valid pay date (the previous cycle's own periodStart), or null if this is the account's first-ever cycle. Applies whether this cycle is open or closed. */
  previousBoundDate?: string | null;
  /** "YYYY-MM-DD", exclusive — the latest valid pay date (the next cycle's periodStart). Only meaningful when closed — the draft cycle has no next neighbor, so its ceiling is "today" instead (computed inside EditPayInfoSheet). */
  nextBoundDate?: string | null;
  /** Defaults to the plain inline-text-link treatment (History's own closed-cycle usage) -- Home's own trigger passes "home-edit-pill" instead for the design system's standalone Edit pill. */
  className?: string;
}) {
  const t = useT().dashboard;
  const { open, triggerProps, sheetProps, close } = useSheet();

  return (
    <>
      <button type="button" className={className} {...triggerProps}>
        {t.editPayInfo.edit}
      </button>

      {open && (
        <EditPayInfoSheet
          initialAmount={currentAmount}
          initialPayDate={currentPayDate}
          cycleId={cycleId}
          closed={closed}
          previousBoundDate={previousBoundDate}
          nextBoundDate={nextBoundDate}
          onDone={close}
          {...sheetProps}
        />
      )}
    </>
  );
}
