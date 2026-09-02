"use client";

import { useActionState } from "react";
import { saveIncomeAction, type IncomeFormState } from "./actions";
import { CurrencyInput } from "@/app/(app)/_components/CurrencyInput";
import { useT } from "@/app/_components/LocaleProvider";

const initialState: IncomeFormState = undefined;

export interface IncomeFormInitial {
  netQuincenaAmount: string;
}

export function IncomeForm({ initial }: { initial?: IncomeFormInitial }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(saveIncomeAction, initialState);

  return (
    <form action={formAction}>
      <div className="field">
        <label htmlFor="netQuincenaAmount">{t.onboarding.income.label}</label>
        <CurrencyInput
          id="netQuincenaAmount"
          name="netQuincenaAmount"
          defaultValue={initial?.netQuincenaAmount}
          required
          className={state?.error ? "is-invalid" : ""}
          invalid={!!state?.error}
          describedBy={state?.error ? "income-amount-error" : undefined}
        />
        <span className="field-hint">{t.onboarding.income.hint}</span>
      </div>

      {state?.error && (
        <p id="income-amount-error" className="error-text" role="alert">
          {state.error}
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="button" disabled={pending}>
          {pending ? t.onboarding.income.saving : t.onboarding.income.continue}
        </button>
      </div>
    </form>
  );
}
