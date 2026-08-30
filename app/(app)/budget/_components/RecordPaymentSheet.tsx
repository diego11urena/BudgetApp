"use client";

import { useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "../../_components/Sheet";
import { CurrencyInput } from "../../_components/CurrencyInput";
import { recordRecurringExpensePaymentAction } from "../recurring-actions";
import { PAYMENT_METHOD_OPTIONS, type PaymentMethod } from "@/lib/payment-method";

/**
 * A deliberately minimal sheet — amount and payment method, pre-filled from
 * the recurring expense's own target but editable for the quincena a bill
 * came in slightly different than usual. Same shape as Goals'
 * ContributeSheet: name/category/type are never in question here. Payment
 * method is the same native <select> QuickAddSheet's own field uses,
 * matching every other transaction-creation flow in the app instead of
 * silently leaving it blank.
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
  const uid = useId();
  const amountId = `${uid}-amount`;
  const errorId = `${uid}-error`;
  const paymentMethodId = `${uid}-payment-method`;

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClose() {
    setVisible(false);
    setTimeout(onDone, 200);
  }

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
    <Sheet visible={visible} title={`Paid ${name}`} onClose={handleClose} returnFocusTo={returnFocusTo}>
      <form onSubmit={handleSubmit}>
        <div className="field sheet-amount-field">
          <label htmlFor={amountId}>Amount (USD)</label>
          <CurrencyInput
            id={amountId}
            defaultValue={amount}
            onValueChange={setAmount}
            autoFocus
            className={`sheet-amount-input ${error ? "is-invalid" : ""}`}
            invalid={!!error}
            describedBy={error ? errorId : undefined}
          />
        </div>

        <div className="field">
          <label htmlFor={paymentMethodId}>Payment method</label>
          <select
            id={paymentMethodId}
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod | "")}
          >
            <option value="">No payment method</option>
            {PAYMENT_METHOD_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p id={errorId} className="error-text" role="alert">
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
    </Sheet>
  );
}
