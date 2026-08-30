"use client";

import { useActionState } from "react";
import { updateIncomeAction, type IncomeSettingsFormState } from "../actions";
import { CurrencyInput } from "../../_components/CurrencyInput";

const initialState: IncomeSettingsFormState = undefined;

export interface IncomeSettingsInitial {
  netQuincenaAmount: string;
}

export function IncomeSettingsForm({ initial }: { initial: IncomeSettingsInitial }) {
  const [state, formAction, pending] = useActionState(updateIncomeAction, initialState);

  return (
    <form action={formAction}>
      <div className="field">
        <label htmlFor="income-net">Net pay per quincena (USD)</label>
        <CurrencyInput
          id="income-net"
          name="netQuincenaAmount"
          required
          defaultValue={initial.netQuincenaAmount}
        />
        <span className="field-hint">
          What actually lands in your account each quincena — after any taxes or deductions
          are already taken out elsewhere.
        </span>
      </div>

      {!!state && "error" in state && <p className="error-text">{state.error}</p>}
      {!!state && "success" in state && (
        <p className="field-hint" style={{ marginTop: "0.5rem" }}>
          Saved — this quincena&apos;s numbers are already updated.
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="button" disabled={pending}>
          {pending ? "Saving..." : "Save income"}
        </button>
      </div>
    </form>
  );
}
