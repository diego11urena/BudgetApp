"use client";

import { useEffect, useId, useState } from "react";
import { confirmNewCycleIncomeAction } from "../actions";
import { Sheet } from "../../_components/Sheet";

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
  const uid = useId();
  const amountId = `${uid}-amount`;
  const errorId = `${uid}-error`;

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

  return (
    <Sheet
      visible={visible}
      title="How much did you get paid?"
      titleStyle={{ textAlign: "center", marginBottom: "0.5rem" }}
      onClose={handleSkip}
      returnFocusTo={returnFocusTo}
    >
      <p className="field-hint" style={{ textAlign: "center", marginBottom: "0.5rem" }}>
        This becomes your available income for the new quincena.
      </p>

      <form onSubmit={handleConfirm}>
        <div className="field">
          <label htmlFor={amountId}>Net pay (USD)</label>
          <input
            id={amountId}
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
            required
            className={`sheet-amount-input ${error ? "is-invalid" : ""}`}
            onFocus={(e) => e.target.select()}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
          />
        </div>

        {error && (
          <p id={errorId} className="error-text" role="alert">
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
    </Sheet>
  );
}
