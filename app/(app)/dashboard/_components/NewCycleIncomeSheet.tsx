"use client";

import { useEffect, useRef, useState } from "react";
import { confirmNewCycleIncomeAction } from "../actions";
import { useModalFocus } from "../../_components/useModalFocus";

/**
 * Shown right after CycleClosedCard, on every "I just got paid" close —
 * pay varies quincena to quincena, so this asks each time instead of
 * silently reusing whatever amount was set last. Prefilled with the amount
 * that was just auto-carried forward, so confirming unchanged is one tap.
 * Calls the action directly (not via useActionState) for the same reason
 * every other sheet in this app does — it revalidates this very page, and
 * a subsequent re-render could tear the sheet down mid-flight otherwise.
 */
export function NewCycleIncomeSheet({
  initialAmount,
  onDone,
  returnFocusTo = null,
}: {
  initialAmount: number;
  onDone: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const [visible, setVisible] = useState(false);
  const [amount, setAmount] = useState(initialAmount.toFixed(2));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleSkip() {
    setVisible(false);
    setTimeout(onDone, 200);
  }

  async function handleConfirm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.set("netQuincenaAmount", amount);
    const result = await confirmNewCycleIncomeAction(fd);

    if (result?.error) {
      setPending(false);
      setError(result.error);
      return;
    }

    setPending(false);
    setVisible(false);
    setTimeout(onDone, 200);
  }

  useModalFocus(sheetRef, handleSkip, returnFocusTo);

  return (
    <div
      className={`sheet-backdrop ${visible ? "is-visible" : ""}`}
      onClick={handleSkip}
      role="presentation"
    >
      <div
        ref={sheetRef}
        tabIndex={-1}
        className={`sheet ${visible ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="How much did you get paid?"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <h2 style={{ textAlign: "center", marginBottom: "0.5rem" }}>How much did you get paid?</h2>
        <p className="field-hint" style={{ textAlign: "center", marginBottom: "0.5rem" }}>
          This becomes your available income for the new quincena.
        </p>

        <form onSubmit={handleConfirm}>
          <div className="field">
            <label htmlFor="new-cycle-income">Net pay (USD)</label>
            <input
              id="new-cycle-income"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
              required
              className={`sheet-amount-input ${error ? "is-invalid" : ""}`}
              onFocus={(e) => e.target.select()}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "new-cycle-income-error" : undefined}
            />
          </div>

          {error && (
            <p id="new-cycle-income-error" className="error-text" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="button sheet-submit" disabled={pending}>
            {pending ? "Saving..." : "Confirm"}
          </button>
        </form>

        <button
          type="button"
          className="button button--secondary sheet-submit"
          onClick={handleSkip}
          disabled={pending}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
