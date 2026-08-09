"use client";

import { useEffect, useRef, useState } from "react";
import { useModalFocus } from "../../_components/useModalFocus";

/**
 * Closing a quincena is the one significant, hard-to-undo action in the
 * app (unlike transaction/budget/goal delete, which have toast+Undo — a
 * true undo here would mean unwinding a whole new cycle plus anything
 * already logged in it, riskier than just confirming first). Uses the
 * same sheet visual language as the rest of the app rather than a native
 * confirm() dialog, which this product deliberately avoids.
 */
export function ConfirmJustGotPaidSheet({
  onConfirm,
  onCancel,
  returnFocusTo = null,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const [visible, setVisible] = useState(false);
  // Guards against a fast double-tap on "Yes, I got paid" firing onConfirm
  // twice — closeCycleAndStartNext has no idempotency guard of its own
  // (unlike everything it creates), so two concurrent calls would each
  // close-and-recreate a cycle, leaving one of the two new cycles orphaned.
  const [confirmed, setConfirmed] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleCancel() {
    if (confirmed) return;
    setVisible(false);
    setTimeout(onCancel, 200);
  }

  function handleConfirm() {
    if (confirmed) return;
    setConfirmed(true);
    setVisible(false);
    setTimeout(onConfirm, 200);
  }

  useModalFocus(sheetRef, handleCancel, returnFocusTo);

  return (
    <div
      className={`sheet-backdrop ${visible ? "is-visible" : ""}`}
      onClick={confirmed ? undefined : handleCancel}
      role="presentation"
    >
      <div
        ref={sheetRef}
        tabIndex={-1}
        className={`sheet ${visible ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Confirm closing this quincena"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <h2 style={{ textAlign: "center", marginBottom: "0.5rem" }}>Close this quincena?</h2>
        <p className="field-hint" style={{ textAlign: "center", marginBottom: "0.5rem" }}>
          This closes your current quincena for good and starts a fresh one. Recurring budget
          targets and goal contributions carry forward automatically.
        </p>
        <button type="button" className="button sheet-submit" onClick={handleConfirm} disabled={confirmed}>
          Yes, I got paid →
        </button>
        <button
          type="button"
          className="button button--secondary sheet-submit"
          onClick={handleCancel}
          disabled={confirmed}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
