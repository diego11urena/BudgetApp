"use client";

import { useActionState } from "react";
import { updateIncomeAction, type IncomeSettingsFormState } from "../actions";

const initialState: IncomeSettingsFormState = undefined;

export interface IncomeSettingsInitial {
  name: string;
  netQuincenaAmount: string;
}

export function IncomeSettingsForm({ initial }: { initial: IncomeSettingsInitial }) {
  const [state, formAction, pending] = useActionState(updateIncomeAction, initialState);

  return (
    <form action={formAction}>
      <div className="field">
        <label htmlFor="income-name">Income name</label>
        <input
          id="income-name"
          name="name"
          type="text"
          defaultValue={initial.name}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="income-net">Net pay per quincena (USD)</label>
        <input
          id="income-net"
          name="netQuincenaAmount"
          type="text"
          inputMode="decimal"
          required
          defaultValue={initial.netQuincenaAmount}
        />
        <span className="field-hint">
          What actually lands in your account each quincena — after any taxes or deductions
          are already taken out elsewhere.
        </span>
      </div>

      {state?.error && <p className="error-text">{state.error}</p>}
      {state?.success && (
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
