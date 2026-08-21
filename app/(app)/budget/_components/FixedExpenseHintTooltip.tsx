"use client";

import { useEffect, useRef, useState } from "react";
import { useModalFocus } from "../../_components/useModalFocus";

/**
 * The one delivery mechanism for "what are fixed expenses" — replaces a
 * static paragraph that used to render in full on every visit. Auto-opened
 * once ever (see BudgetGoalsPanel's hasSeenHint check) and reopenable any
 * time via the ⓘ button; there's no second explanation surface anywhere
 * else on this screen.
 */
export function FixedExpenseHintTooltip({
  onClose,
  returnFocusTo = null,
}: {
  onClose: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const [visible, setVisible] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 200);
  }

  useModalFocus(sheetRef, handleClose, returnFocusTo);

  return (
    <div className={`sheet-backdrop ${visible ? "is-visible" : ""}`} onClick={handleClose} role="presentation">
      <div
        ref={sheetRef}
        tabIndex={-1}
        className={`sheet ${visible ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="About fixed expenses"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <p className="field-hint" style={{ textAlign: "center", marginBottom: "0.75rem" }}>
          Recurring fixed expenses carry into every quincena by default — tap &quot;Edit&quot; to switch
          one to a specific day each month instead, or remove it.
        </p>
        <button type="button" className="button button--secondary sheet-submit" onClick={handleClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
