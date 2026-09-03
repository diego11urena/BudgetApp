"use client";

import { useState, useTransition } from "react";
import type { IncomeFrequency } from "@/app/generated/prisma/client";
import type { BudgetFrequency } from "@/lib/quincena-pace";
import { setBudgetFrequencyAction, setIncomeFrequencyAction } from "../actions";
import { useT } from "../../../_components/LocaleProvider";

const PAY_FREQUENCY_VALUES: IncomeFrequency[] = ["MONTHLY", "SEMIMONTHLY"];
const PAY_FREQUENCY_LABEL_KEY: Record<IncomeFrequency, "monthly" | "semimonthly"> = {
  MONTHLY: "monthly",
  SEMIMONTHLY: "semimonthly",
};
const BUDGET_FREQUENCY_VALUES: BudgetFrequency[] = ["QUINCENAL", "MONTHLY"];

/**
 * Replaces what used to be two fully independent rows (BudgetFrequencyRow,
 * IncomeFrequencyRow) -- merged into one component because the two settings
 * are no longer independent in one direction: a once-a-month earner
 * (payFrequency MONTHLY) has no second paycheck to split a quincena
 * around, so budgetFrequency QUINCENAL isn't a selectable combination once
 * payFrequency is MONTHLY. Two separate client components with their own
 * local state couldn't express that constraint without either lifting
 * state up (this component) or plumbing a callback between siblings --
 * this is the simpler of the two.
 *
 * Optimistic like both rows already were: local state flips immediately on
 * tap, the server action fires in a transition, and setIncomeFrequencyAction
 * itself performs the atomic "MONTHLY pay forces MONTHLY budget" write --
 * so this component's optimistic budgetFrequency update (below) can never
 * actually disagree with what the server persists.
 */
export function PayAndBudgetFrequencyRows({
  initialPayFrequency,
  initialBudgetFrequency,
}: {
  initialPayFrequency: IncomeFrequency;
  initialBudgetFrequency: BudgetFrequency;
}) {
  const t = useT();
  const [payFrequency, setPayFrequency] = useState(initialPayFrequency);
  const [budgetFrequency, setBudgetFrequency] = useState(initialBudgetFrequency);
  const [pending, startTransition] = useTransition();

  function handlePayFrequencySelect(value: IncomeFrequency) {
    if (value === payFrequency) return;
    setPayFrequency(value);
    if (value === "MONTHLY") setBudgetFrequency("MONTHLY");
    const formData = new FormData();
    formData.set("payFrequency", value);
    startTransition(async () => {
      await setIncomeFrequencyAction(formData);
    });
  }

  function handleBudgetFrequencySelect(value: BudgetFrequency) {
    if (value === budgetFrequency || (value === "QUINCENAL" && payFrequency === "MONTHLY")) return;
    setBudgetFrequency(value);
    const formData = new FormData();
    formData.set("budgetFrequency", value);
    startTransition(async () => {
      await setBudgetFrequencyAction(formData);
    });
  }

  return (
    <>
      <div className="line-item profile-theme-row">
        <span className="line-item-title">{t.profile.payFrequency}</span>
        <div className="theme-picker" role="group" aria-label={t.profile.payFrequency}>
          {PAY_FREQUENCY_VALUES.map((value) => (
            <button
              key={value}
              type="button"
              className={`theme-picker-option${payFrequency === value ? " is-active" : ""}`}
              aria-pressed={payFrequency === value}
              disabled={pending}
              onClick={() => handlePayFrequencySelect(value)}
            >
              {t.common.payFrequency[PAY_FREQUENCY_LABEL_KEY[value]]}
            </button>
          ))}
        </div>
      </div>

      <div className="line-item profile-theme-row">
        <span className="line-item-title">{t.profile.budgetFrequency}</span>
        <div className="theme-picker" role="group" aria-label={t.profile.budgetFrequency}>
          {BUDGET_FREQUENCY_VALUES.map((value) => {
            const disabled = pending || (value === "QUINCENAL" && payFrequency === "MONTHLY");
            return (
              <button
                key={value}
                type="button"
                className={`theme-picker-option${budgetFrequency === value ? " is-active" : ""}`}
                aria-pressed={budgetFrequency === value}
                disabled={disabled}
                onClick={() => handleBudgetFrequencySelect(value)}
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
    </>
  );
}
