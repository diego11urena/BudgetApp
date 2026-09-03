"use client";

import { useState, useActionState } from "react";
import { saveIncomeAction, type IncomeFormState } from "./actions";
import { CurrencyInput } from "@/app/(app)/_components/CurrencyInput";
import { useT } from "@/app/_components/LocaleProvider";
import type { BudgetFrequency } from "@/lib/quincena-pace";
import type { IncomeFrequency } from "@/app/generated/prisma/client";

const initialState: IncomeFormState = undefined;

export interface IncomeFormInitial {
  netPayAmount?: string;
  budgetFrequency: BudgetFrequency;
  payFrequency: IncomeFrequency;
}

const BUDGET_FREQUENCY_VALUES: BudgetFrequency[] = ["QUINCENAL", "MONTHLY"];
const PAY_FREQUENCY_VALUES: IncomeFrequency[] = ["MONTHLY", "SEMIMONTHLY"];

const PAY_FREQUENCY_LABEL_KEY: Record<IncomeFrequency, "monthly" | "semimonthly"> = {
  MONTHLY: "monthly",
  SEMIMONTHLY: "semimonthly",
};

export function IncomeForm({ initial }: { initial?: IncomeFormInitial }) {
  const t = useT();
  const [state, formAction, pending] = useActionState(saveIncomeAction, initialState);
  const [payFrequency, setPayFrequency] = useState<IncomeFrequency>(initial?.payFrequency ?? "SEMIMONTHLY");
  // A once-a-month earner has no second paycheck to split a quincena
  // around -- MONTHLY pay only ever pairs with MONTHLY budget. Seeded from
  // payFrequency too (not just initial?.budgetFrequency) so a stored state
  // that predates this rule can't render this picker already showing an
  // unsupported combination.
  const [budgetFrequency, setBudgetFrequency] = useState<BudgetFrequency>(
    initial?.payFrequency === "MONTHLY" ? "MONTHLY" : (initial?.budgetFrequency ?? "QUINCENAL"),
  );
  // Reflects the picker's own live (not-yet-submitted) selection below, not
  // the account's already-stored setting -- so the label/hint text updates
  // the instant someone taps "Monthly," before they've saved anything.
  const vocab = t.periodVocab[budgetFrequency === "MONTHLY" ? "monthly" : "quincenal"];

  function handlePayFrequencyChange(value: IncomeFrequency) {
    setPayFrequency(value);
    if (value === "MONTHLY") setBudgetFrequency("MONTHLY");
  }

  return (
    <form action={formAction}>
      <div className="field">
        <label htmlFor="netPayAmount">{t.onboarding.income.label(vocab)}</label>
        <CurrencyInput
          id="netPayAmount"
          name="netPayAmount"
          defaultValue={initial?.netPayAmount}
          required
          className={state?.error ? "is-invalid" : ""}
          invalid={!!state?.error}
          describedBy={state?.error ? "income-amount-error" : undefined}
        />
        <span className="field-hint">{t.onboarding.income.hint(vocab)}</span>
      </div>

      {/* Asked first -- budget frequency's own options below depend on this
          answer (once-a-month pay only ever pairs with a monthly budget),
          so the picker that constrains the other one comes first. */}
      <div className="field">
        <label>{t.onboarding.income.payCadenceLabel}</label>
        <input type="hidden" name="payFrequency" value={payFrequency} />
        <div className="theme-picker" role="group" aria-label={t.onboarding.income.payCadenceLabel}>
          {PAY_FREQUENCY_VALUES.map((value) => (
            <button
              key={value}
              type="button"
              className={`theme-picker-option${payFrequency === value ? " is-active" : ""}`}
              aria-pressed={payFrequency === value}
              onClick={() => handlePayFrequencyChange(value)}
            >
              {t.common.payFrequency[PAY_FREQUENCY_LABEL_KEY[value]]}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label>{t.onboarding.income.cadenceLabel}</label>
        <input type="hidden" name="budgetFrequency" value={budgetFrequency} />
        <div className="theme-picker" role="group" aria-label={t.onboarding.income.cadenceLabel}>
          {BUDGET_FREQUENCY_VALUES.map((value) => {
            // Monthly pay has no second paycheck to split a quincena
            // around -- disabled, not hidden, so it's still visible *why*
            // only one option is choosable, matching the pattern used
            // wherever else this app locks a control instead of removing
            // it. handlePayFrequencyChange already forced budgetFrequency
            // to MONTHLY the moment payFrequency became MONTHLY, so this
            // can never actually be clicked into a QUINCENAL selection --
            // disabled is belt-and-suspenders against a stray click event.
            const disabled = value === "QUINCENAL" && payFrequency === "MONTHLY";
            return (
              <button
                key={value}
                type="button"
                className={`theme-picker-option${budgetFrequency === value ? " is-active" : ""}`}
                aria-pressed={budgetFrequency === value}
                disabled={disabled}
                onClick={() => setBudgetFrequency(value)}
              >
                {value === "QUINCENAL" ? t.common.budgetFrequency.quincenal : t.common.budgetFrequency.monthly}
              </button>
            );
          })}
        </div>
        {payFrequency === "MONTHLY" && (
          <span className="field-hint">{t.onboarding.income.monthlyPayLocksMonthlyBudget}</span>
        )}
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
