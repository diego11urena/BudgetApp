"use client";

import { useState } from "react";
import { EditPayInfoSheet } from "./EditPayInfoSheet";

/**
 * Plain-text "Edit" trigger for correcting this quincena's already-recorded
 * pay amount/date — separate from "I just got paid" (HeroCard), which
 * always starts a new cycle instead of correcting the current one.
 */
export function EditPayInfoButton({
  currentAmount,
  currentPayDate,
}: {
  currentAmount: number;
  /** "YYYY-MM-DD" — the current cycle's periodStart. */
  currentPayDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);

  return (
    <>
      <button
        type="button"
        className="home-header-edit-link"
        onClick={(e) => {
          setTriggerElement(e.currentTarget);
          setOpen(true);
        }}
      >
        Edit
      </button>

      {open && (
        <EditPayInfoSheet
          initialAmount={currentAmount}
          initialPayDate={currentPayDate}
          returnFocusTo={triggerElement}
          onDone={() => setOpen(false)}
        />
      )}
    </>
  );
}
