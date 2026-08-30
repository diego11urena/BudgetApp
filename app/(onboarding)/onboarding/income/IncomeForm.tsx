"use client";

import { useActionState } from "react";
import { saveIncomeAction, type IncomeFormState } from "./actions";
import { CurrencyInput } from "@/app/(app)/_components/CurrencyInput";

const initialState: IncomeFormState = undefined;

export interface IncomeFormInitial {
  netQuincenaAmount: string;
}

export function IncomeForm({ initial }: { initial?: IncomeFormInitial }) {
  const [state, formAction, pending] = useActionState(saveIncomeAction, initialState);

  return (
    <form action={formAction}>
      <div className="field">
        <label htmlFor="netQuincenaAmount">Net pay per quincena (USD)</label>
        <CurrencyInput
          id="netQuincenaAmount"
          name="netQuincenaAmount"
          defaultValue={initial?.netQuincenaAmount}
          required
          className={state?.error ? "is-invalid" : ""}
          invalid={!!state?.error}
          describedBy={state?.error ? "income-amount-error" : undefined}
        />
        <span className="field-hint">
          What actually lands in your account each quincena — after any taxes or deductions
          are already taken out elsewhere.
        </span>
      </div>

      {state?.error && (
        <p id="income-amount-error" className="error-text" role="alert">
          {state.error}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="button" disabled={pending}>
          {pending ? "Saving..." : "Continue"}
        </button>
      </div>
    </form>
  );
}
