"use client";

import { useState, type MouseEvent } from "react";

/**
 * The trigger-capture-for-focus-return pattern every sheet-opening button
 * in this app repeated on its own: an `open` boolean plus the exact
 * element that opened it, captured synchronously on click (not derived
 * later -- see QuickAddSheet's own returnFocusTo doc comment for why),
 * so the sheet can hand focus back to the right place once it closes.
 */
export function useSheet() {
  const [open, setOpen] = useState(false);
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);

  return {
    open,
    /** Spread onto whatever element opens the sheet (usually a <button>). */
    triggerProps: {
      onClick: (e: MouseEvent<HTMLElement>) => {
        setTriggerElement(e.currentTarget);
        setOpen(true);
      },
    },
    /** Spread straight onto the sheet component -- just returnFocusTo; each sheet keeps its own onClose/onDone prop name and close-animation timing. */
    sheetProps: {
      returnFocusTo: triggerElement,
    },
    close: () => setOpen(false),
    /**
     * The raw trigger setter, for a caller whose own "is it open" state
     * isn't this hook's plain boolean (e.g. a union of which sheet variant
     * to show) -- captures the trigger without touching `open`.
     */
    setTrigger: setTriggerElement,
  };
}
