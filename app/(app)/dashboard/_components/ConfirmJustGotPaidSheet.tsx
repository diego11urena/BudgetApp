"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useModalFocus } from "../../_components/useModalFocus";
import { formatCycleLabel, PAY_DATE_LOOKBACK_DAYS } from "@/lib/pay-date";

function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

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
  onConfirm: (payDate: string) => void;
  onCancel: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const [visible, setVisible] = useState(false);
  // Guards against a fast double-tap on "Yes, I got paid" firing onConfirm
  // twice — closeCycleAndStartNext has no idempotency guard of its own
  // (unlike everything it creates), so two concurrent calls would each
  // close-and-recreate a cycle, leaving one of the two new cycles orphaned.
  const [confirmed, setConfirmed] = useState(false);
  // Defaults to today (the moment this sheet opens), but editable to an
  // actual past payday — see lib/cycles.ts's parsePayDate for why this
  // matters to days-remaining/pace math downstream.
  const [payDate, setPayDate] = useState(() => formatCycleLabel());
  const [error, setError] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const minDate = formatCycleLabel(daysAgo(PAY_DATE_LOOKBACK_DAYS));
  const maxDate = formatCycleLabel();

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
    // There's no <form> here (this button isn't a submit), so the date
    // input's min/max never get a chance to block anything — they're just
    // the picker widget's own hint. Without this check, an out-of-range
    // value would reach justGotPaidAction, which silently substitutes
    // today's date (see lib/pay-date.ts's parsePayDate) with no feedback
    // that the date you picked was ignored.
    if (payDate < minDate || payDate > maxDate) {
      setError(`Date must be between ${minDate} and ${maxDate}`);
      return;
    }
    setError(null);
    setConfirmed(true);
    setVisible(false);
    setTimeout(() => onConfirm(payDate), 200);
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
          targets and goal contributions carry forward automatically — you&apos;ll confirm this
          quincena&apos;s pay amount next.
        </p>
        <div className="field">
          <label htmlFor="pay-date">When did you get paid?</label>
          <input
            id="pay-date"
            type="date"
            value={payDate}
            min={minDate}
            max={maxDate}
            disabled={confirmed}
            className={error ? "is-invalid" : ""}
            onChange={(e) => {
              setPayDate(e.target.value);
              setError(null);
            }}
          />
        </div>
        {error && <p className="error-text">{error}</p>}
        <button type="button" className="button sheet-submit" onClick={handleConfirm} disabled={confirmed}>
          Yes, I got paid <ArrowRight size={16} aria-hidden="true" />
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
