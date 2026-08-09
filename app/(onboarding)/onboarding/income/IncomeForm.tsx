"use client";

import { useActionState } from "react";
import { saveIncomeAction, type IncomeFormState } from "./actions";

const initialState: IncomeFormState = undefined;

export interface IncomeFormInitial {
  name: string;
  netQuincenaAmount: string;
}

export function IncomeForm({ initial }: { initial?: IncomeFormInitial }) {
  const [state, formAction, pending] = useActionState(saveIncomeAction, initialState);

  return (
    <form action={formAction}>
      <div className="field">
        <label htmlFor="name">Income name</label>
        <input
          id="name"
          name="name"
          type="text"
          placeholder="Main job salary"
          defaultValue={initial?.name}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="netQuincenaAmount">Net pay per quincena (USD)</label>
        <input
          id="netQuincenaAmount"
          name="netQuincenaAmount"
          type="text"
          inputMode="decimal"
          placeholder="1000.00"
          defaultValue={initial?.netQuincenaAmount}
          required
        />
        <span className="field-hint">
          What actually lands in your account each quincena — after any taxes or deductions
          are already taken out elsewhere.
        </span>
      </div>

      {state?.error && <p className="error-text">{state.error}</p>}

      <div className="form-actions">
        <button type="submit" className="button" disabled={pending}>
          {pending ? "Saving..." : "Continue"}
        </button>
      </div>
    </form>
  );
}
