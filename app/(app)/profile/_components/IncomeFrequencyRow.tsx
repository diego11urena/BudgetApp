"use client";

import { useState, useTransition } from "react";
import type { IncomeFrequency } from "@/app/generated/prisma/client";
import { setIncomeFrequencyAction } from "../actions";
import { useT } from "../../../_components/LocaleProvider";

const PAY_FREQUENCY_VALUES: IncomeFrequency[] = ["MONTHLY", "SEMIMONTHLY", "BIWEEKLY"];
const PAY_FREQUENCY_LABEL_KEY: Record<IncomeFrequency, "monthly" | "semimonthly" | "biweekly"> = {
  MONTHLY: "monthly",
  SEMIMONTHLY: "semimonthly",
  BIWEEKLY: "biweekly",
};

/**
 * Optimistic, same pattern as BudgetFrequencyRow -- purely descriptive
 * (see User.payFrequency's own schema comment: gates no calculation), so
 * there's nothing to reconcile with any in-flight cycle math the way a
 * budgetFrequency switch conceptually could.
 */
export function IncomeFrequencyRow({ initialPayFrequency }: { initialPayFrequency: IncomeFrequency }) {
  const t = useT();
  const [payFrequency, setPayFrequency] = useState(initialPayFrequency);
  const [pending, startTransition] = useTransition();

  function handleSelect(value: IncomeFrequency) {
    if (value === payFrequency) return;
    setPayFrequency(value);
    const formData = new FormData();
    formData.set("payFrequency", value);
    startTransition(async () => {
      await setIncomeFrequencyAction(formData);
    });
  }

  return (
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
            onClick={() => handleSelect(value)}
          >
            {t.common.payFrequency[PAY_FREQUENCY_LABEL_KEY[value]]}
          </button>
        ))}
      </div>
    </div>
  );
}
