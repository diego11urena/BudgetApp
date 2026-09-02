"use client";

import { createContext, useContext, useMemo } from "react";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { LocaleValue } from "@/lib/i18n/locale";

/**
 * Takes only the resolved locale STRING from the server (see
 * app/layout.tsx) and calls getDictionary() again right here, client-side
 * -- the dictionary itself is never passed as a prop across the server/
 * client boundary. It can't be: templated strings are plain functions
 * (`tooManyAttempts: (seconds) => string`), and React Server Components
 * can only serialize functions across that boundary when they're actual
 * "use server" actions, not arbitrary closures. get-dictionary.ts has no
 * server-only APIs (it's just object literals), so calling it again here
 * is cheap and safe -- this is the ONE place in the app that does.
 */
const LocaleContext = createContext<{ locale: LocaleValue; t: Dictionary } | null>(null);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: LocaleValue;
  children: React.ReactNode;
}) {
  const t = useMemo(() => getDictionary(locale), [locale]);
  return <LocaleContext.Provider value={{ locale, t }}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within a LocaleProvider");
  return ctx.locale;
}

export function useT(): Dictionary {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useT must be used within a LocaleProvider");
  return ctx.t;
}
