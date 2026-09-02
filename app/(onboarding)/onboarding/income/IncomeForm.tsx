"use client";

import { useState, useActionState } from "react";
import { saveIncomeAction, type IncomeFormState } from "./actions";
import { CurrencyInput } from "@/app/(app)/_components/CurrencyInput";
import { useT } from "@/app/_components/LocaleProvider";
import type { PayFrequency } from "@/lib/quincena-pace";

const initialState: IncomeFormState = undefined;

export interface IncomeFormInitial {
  netPayAmount?: string;
  payFrequency: PayFrequency;
}

const PAY_FREQUENCY_VALUES: PayFrequency[] = ["QUINCENAL", "MONTHLY"];

export function IncomeForm({ initial }: { initial?: IncomeFormInitial }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(saveIncomeAction, initialState);
  const [payFrequency, setPayFrequency] = useState<PayFrequency>(initial?.payFrequency ?? "QUINCENAL");

  return (
    <form action={formAction}>
      <div className="field">
        <label htmlFor="netPayAmount">{t.onboarding.income.label}</label>
        <CurrencyInput
          id="netPayAmount"
          name="netPayAmount"
          defaultValue={initial?.netPayAmount}
          required
          className={state?.error ? "is-invalid" : ""}
          invalid={!!state?.error}
          describedBy={state?.error ? "income-amount-error" : undefined}
        />
        <span className="field-hint">{t.onboarding.income.hint}</span>
      </div>

      <div className="field">
        <label>{t.onboarding.income.cadenceLabel}</label>
        <input type="hidden" name="payFrequency" value={payFrequency} />
        <div className="theme-picker" role="group" aria-label={t.onboarding.income.cadenceLabel}>
          {PAY_FREQUENCY_VALUES.map((value) => (
            <button
              key={value}
              type="button"
              className={`theme-picker-option${payFrequency === value ? " is-active" : ""}`}
              aria-pressed={payFrequency === value}
              onClick={() => setPayFrequency(value)}
            >
              {value === "QUINCENAL" ? t.common.payFrequency.quincenal : t.common.payFrequency.monthly}
            </button>
          ))}
        </div>
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
