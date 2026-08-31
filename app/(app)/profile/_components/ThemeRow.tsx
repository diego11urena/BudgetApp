"use client";

import { useState, useTransition } from "react";
import { THEME_LABEL, THEME_VALUES, type ThemePreferenceValue } from "@/lib/theme";
import { setThemeAction } from "../actions";

/**
 * Applies immediately on click (optimistic -- setThemeAction's cookie/DB
 * write happens in the background) rather than waiting on a full page
 * reload, mirroring what ThemeScript does on first load: "system" is
 * resolved to a concrete light/dark value right here instead of just
 * clearing the attribute, so the picker's own highlighted option and the
 * page's actual appearance never disagree.
 */
function applyThemeClientSide(value: ThemePreferenceValue) {
  const root = document.documentElement;
  if (value === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.setAttribute("data-theme", prefersDark ? "dark" : "light");
  } else {
    root.setAttribute("data-theme", value);
  }
}

export function ThemeRow({ initialTheme }: { initialTheme: ThemePreferenceValue }) {
  const [theme, setTheme] = useState(initialTheme);
  const [pending, startTransition] = useTransition();

  function handleSelect(value: ThemePreferenceValue) {
    if (value === theme) return;
    setTheme(value);
    applyThemeClientSide(value);
    const formData = new FormData();
    formData.set("theme", value);
    startTransition(async () => {
      await setThemeAction(formData);
    });
  }

  return (
    <div className="line-item profile-theme-row">
      <span className="line-item-title">Theme</span>
      <div className="theme-picker" role="group" aria-label="Theme">
        {THEME_VALUES.map((value) => (
          <button
            key={value}
            type="button"
            className={`theme-picker-option${theme === value ? " is-active" : ""}`}
            aria-pressed={theme === value}
            disabled={pending}
            onClick={() => handleSelect(value)}
          >
            {THEME_LABEL[value]}
          </button>
        ))}
      </div>
    </div>
  );
}
