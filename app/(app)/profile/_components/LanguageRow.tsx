"use client";

import { useState, useTransition } from "react";
import { LOCALE_LABEL, LOCALE_VALUES, type LocaleValue } from "@/lib/i18n/locale";
import { useT } from "../../../_components/LocaleProvider";
import { setLocaleAction } from "../actions";

/**
 * Applies immediately on click, same pattern as ThemeRow: the picker's
 * highlighted option changes right away, and a full reload (router.refresh
 * would only re-render the current route's server components, not the
 * root layout that resolved the dictionary) is what actually makes the
 * REST of the app switch language -- forced here rather than left to the
 * next natural navigation, so the choice feels immediate.
 */
export function LanguageRow({ initialLocale }: { initialLocale: LocaleValue }) {
  const t = useT();
  const [locale, setLocale] = useState(initialLocale);
  const [pending, startTransition] = useTransition();

  function handleSelect(value: LocaleValue) {
    if (value === locale) return;
    setLocale(value);
    const formData = new FormData();
    formData.set("locale", value);
    startTransition(async () => {
      await setLocaleAction(formData);
      window.location.reload();
    });
  }

  return (
    <div className="line-item profile-theme-row">
      <span className="line-item-title">{t.profile.language}</span>
      <div className="theme-picker" role="group" aria-label={t.profile.language}>
        {LOCALE_VALUES.map((value) => (
          <button
            key={value}
            type="button"
            className={`theme-picker-option${locale === value ? " is-active" : ""}`}
            aria-pressed={locale === value}
            disabled={pending}
            onClick={() => handleSelect(value)}
          >
            {LOCALE_LABEL[value]}
          </button>
        ))}
      </div>
    </div>
  );
}
