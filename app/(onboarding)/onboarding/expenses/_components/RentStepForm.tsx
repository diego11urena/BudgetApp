"use client";

import { useActionState, useId, useState } from "react";
import type { ExpensesFormState } from "../actions";

/**
 * Replaces the old open-ended "add as many fixed expenses as you like"
 * line-item builder (12-20 text inputs on a phone before ever reaching the
 * dashboard) with the one question that actually matters at signup time --
 * see the Balboa fix list's batch 11.6. Everything else accumulates
 * naturally later (the "This is a bill" toggle on any transaction, or
 * Plan's own "+ New bill"), so onboarding doesn't need to front-load it.
 * Still submits through saveExpensesAction's existing items[] shape --
 * just a 0- or 1-item array instead of an open-ended one, so no server
 * action changes were needed for this step specifically.
 */
export function RentStepForm({
  action,
  initialAmount,
}: {
  action: (prevState: ExpensesFormState, formData: FormData) => Promise<ExpensesFormState>;
  initialAmount?: string;
}) {
  const [state, formAction, pending] = useActionState<ExpensesFormState, FormData>(action, undefined);
  const [amount, setAmount] = useState(initialAmount ?? "");
  const uid = useId();
  const amountId = `${uid}-amount`;

  // A blank amount is a real, valid answer (e.g. living with family, no
  // rent) -- saveExpensesAction already accepts an empty items[] fine.
  const itemsJson = JSON.stringify(amount.trim() ? [{ name: "Rent", targetAmount: amount }] : []);

  return (
    <form action={formAction}>
      <input type="hidden" name="itemsJson" value={itemsJson} readOnly />
      <div className="field">
        <label htmlFor={amountId}>Rent per quincena (USD)</label>
        <input
          id={amountId}
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          autoFocus
        />
        <span className="field-hint">Leave blank if you don&apos;t pay rent.</span>
      </div>

      {!!state && "error" in state && <p className="error-text">{state.error}</p>}

      <div className="form-actions">
        <button type="submit" className="button" disabled={pending}>
          {pending ? "Saving..." : "Continue"}
        </button>
      </div>
    </form>
  );
}
