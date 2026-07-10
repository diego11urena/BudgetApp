"use client";

import { useActionState } from "react";
import { saveIncomeAction, type IncomeFormState } from "./actions";
import { IncomePreview } from "./IncomePreview";

const initialState: IncomeFormState = undefined;

export interface IncomeFormInitial {
  name: string;
  grossMonthlyAmount: string;
  isPanamaPayroll: boolean;
}

export function IncomeForm({
  cycleMonth,
  initial,
}: {
  cycleMonth: number;
  initial?: IncomeFormInitial;
}) {
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

      <IncomePreview cycleMonth={cycleMonth} initial={initial} />

      {state?.error && <p className="error-text">{state.error}</p>}

      <div className="form-actions">
        <button type="submit" className="button" disabled={pending}>
          {pending ? "Saving..." : "Continue"}
        </button>
      </div>
    </form>
  );
}
