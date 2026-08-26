"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useModalFocus } from "../../_components/useModalFocus";
import { recordRecurringExpensePaymentAction } from "../recurring-actions";

type PaymentMethod = "CASH" | "CREDIT_CARD" | "DEBIT_CARD" | "YAPPY" | "ACH";

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Cash" },
  { value: "CREDIT_CARD", label: "Credit Card" },
  { value: "DEBIT_CARD", label: "Debit Card" },
  { value: "YAPPY", label: "Yappy" },
  { value: "ACH", label: "ACH" },
];

/**
 * A deliberately minimal sheet — amount and payment method, pre-filled from
 * the recurring expense's own target but editable for the quincena a bill
 * came in slightly different than usual. Same shape as Goals'
 * ContributeSheet: name/category/type are never in question here. Payment
 * method uses the same chip pattern as QuickAddSheet's own field, matching
 * every other transaction-creation flow in the app instead of silently
 * leaving it blank.
 */
export function RecordPaymentSheet({
  recurringExpenseId,
  name,
  targetAmount,
  onDone,
  returnFocusTo = null,
}: {
  recurringExpenseId: string;
  name: string;
  targetAmount: number;
  onDone: () => void;
  returnFocusTo?: HTMLElement | null;
}) {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [amount, setAmount] = useState(targetAmount.toFixed(2));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onDone, 200);
  }

  useModalFocus(sheetRef, handleClose, returnFocusTo);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);

    // try/finally, not a bare await: a rejected promise (a network
    // failure, not a validation/server error -- those already come back
    // as a normal { error } return) would otherwise skip setPending(false)
    // entirely, leaving the submit button disabled forever.
    try {
      const fd = new FormData();
      fd.set("recurringExpenseId", recurringExpenseId);
      fd.set("amount", amount);
      if (paymentMethod) fd.set("paymentMethod", paymentMethod);
      const result = await recordRecurringExpensePaymentAction(undefined, fd);

      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      router.refresh();
      handleClose();
    } catch {
      setError("Something went wrong. Your changes weren't saved — please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={`sheet-backdrop ${visible ? "is-visible" : ""}`} onClick={handleClose} role="presentation">
      <div
        ref={sheetRef}
        tabIndex={-1}
        className={`sheet ${visible ? "is-open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Record payment for ${name}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <h2 style={{ textAlign: "center", marginBottom: "1rem" }}>Paid {name}</h2>

        <form onSubmit={handleSubmit}>
          <div className="field sheet-amount-field">
            <label htmlFor="record-payment-amount">Amount (USD)</label>
            <input
              id="record-payment-amount"
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
              required
              className={`sheet-amount-input ${error ? "is-invalid" : ""}`}
              onFocus={(e) => e.target.select()}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "record-payment-error" : undefined}
            />
          </div>

          <div className="field">
            <label>Payment method</label>
            <div className="category-chips">
              {PAYMENT_METHOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`category-chip ${paymentMethod === opt.value ? "is-active" : ""}`}
                  onClick={() => setPaymentMethod((current) => (current === opt.value ? "" : opt.value))}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <p id="record-payment-error" className="error-text" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="button sheet-submit" disabled={pending}>
            {pending ? "Logging..." : "Record payment"}
          </button>
        </form>
        <button type="button" className="button button--secondary sheet-submit" onClick={handleClose} disabled={pending}>
          Cancel
        </button>
      </div>
    </div>
  );
}
