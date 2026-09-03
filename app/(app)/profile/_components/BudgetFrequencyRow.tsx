"use client";

import { useState, useTransition } from "react";
import type { BudgetFrequency } from "@/lib/quincena-pace";
import { setBudgetFrequencyAction } from "../actions";
import { useT } from "../../../_components/LocaleProvider";

const BUDGET_FREQUENCY_VALUES: BudgetFrequency[] = ["QUINCENAL", "MONTHLY"];

/**
 * Optimistic, same pattern as ThemeRow -- no full reload needed (unlike
 * LanguageRow, which forces one to re-resolve the root layout's dictionary).
 * A cadence switch is purely forward-looking (see lib/cycles.ts's carry-
 * forward and lib/quincena-pace.ts's boundary math): every page that reads
 * budgetFrequency already does a fresh per-request DB read, so the very next
 * navigation to Home/Activity/Plan picks up the new setting on its own.
 */
export function BudgetFrequencyRow({ initialBudgetFrequency }: { initialBudgetFrequency: BudgetFrequency }) {
  const t = useT();
  const [budgetFrequency, setBudgetFrequency] = useState(initialBudgetFrequency);
  const [pending, startTransition] = useTransition();

  function handleSelect(value: BudgetFrequency) {
    if (value === budgetFrequency) return;
    setBudgetFrequency(value);
    const formData = new FormData();
    formData.set("budgetFrequency", value);
    startTransition(async () => {
      await setBudgetFrequencyAction(formData);
    });
  }

  return (
    <div className="line-item profile-theme-row">
      <span className="line-item-title">{t.profile.budgetFrequency}</span>
      <div className="theme-picker" role="group" aria-label={t.profile.budgetFrequency}>
        {BUDGET_FREQUENCY_VALUES.map((value) => (
          <button
            key={value}
            type="button"
            className={`theme-picker-option${budgetFrequency === value ? " is-active" : ""}`}
            aria-pressed={budgetFrequency === value}
            disabled={pending}
            onClick={() => handleSelect(value)}
          >
            {value === "QUINCENAL" ? t.common.budgetFrequency.quincenal : t.common.budgetFrequency.monthly}
          </button>
        ))}
      </div>
    </div>
  );
}
