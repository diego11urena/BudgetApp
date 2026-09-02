"use client";

import { useState, useTransition } from "react";
import type { PayFrequency } from "@/lib/quincena-pace";
import { setPayFrequencyAction } from "../actions";
import { useT } from "../../../_components/LocaleProvider";

const PAY_FREQUENCY_VALUES: PayFrequency[] = ["QUINCENAL", "MONTHLY"];

/**
 * Optimistic, same pattern as ThemeRow -- no full reload needed (unlike
 * LanguageRow, which forces one to re-resolve the root layout's dictionary).
 * A cadence switch is purely forward-looking (see lib/cycles.ts's carry-
 * forward and lib/quincena-pace.ts's boundary math): every page that reads
 * payFrequency already does a fresh per-request DB read, so the very next
 * navigation to Home/Activity/Plan picks up the new setting on its own.
 */
export function PayFrequencyRow({ initialPayFrequency }: { initialPayFrequency: PayFrequency }) {
  const t = useT();
  const [payFrequency, setPayFrequency] = useState(initialPayFrequency);
  const [pending, startTransition] = useTransition();

  function handleSelect(value: PayFrequency) {
    if (value === payFrequency) return;
    setPayFrequency(value);
    const formData = new FormData();
    formData.set("payFrequency", value);
    startTransition(async () => {
      await setPayFrequencyAction(formData);
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
            {value === "QUINCENAL" ? t.common.payFrequency.quincenal : t.common.payFrequency.monthly}
          </button>
        ))}
      </div>
    </div>
  );
}
