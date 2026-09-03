"use client";

import { createContext, useContext, useMemo } from "react";
import type { Dictionary, PeriodVocab } from "@/lib/i18n/dictionary";
import { getDictionary, resolveVocab } from "@/lib/i18n/get-dictionary";
import type { LocaleValue } from "@/lib/i18n/locale";
import type { BudgetFrequency } from "@/lib/quincena-pace";

/**
 * Takes only the resolved locale STRING and budgetFrequency STRING from the
 * server (see app/layout.tsx) and calls getDictionary() again right here,
 * client-side -- the dictionary/vocab objects themselves are never passed
 * as props across the server/client boundary. They can't be: templated
 * strings are plain functions (`tooManyAttempts: (seconds) => string`), and
 * React Server Components can only serialize functions across that
 * boundary when they're actual "use server" actions, not arbitrary
 * closures. get-dictionary.ts has no server-only APIs (it's just object
 * literals), so calling it again here is cheap and safe -- this is the ONE
 * place in the app that does.
 */
const LocaleContext = createContext<{
  locale: LocaleValue;
  t: Dictionary;
  budgetFrequency: BudgetFrequency;
  vocab: PeriodVocab;
} | null>(null);

export function LocaleProvider({
  locale,
  budgetFrequency,
  children,
}: {
  locale: LocaleValue;
  budgetFrequency: BudgetFrequency;
  children: React.ReactNode;
}) {
  const t = useMemo(() => getDictionary(locale), [locale]);
  const vocab = useMemo(() => resolveVocab(t, budgetFrequency), [t, budgetFrequency]);
  return <LocaleContext.Provider value={{ locale, t, budgetFrequency, vocab }}>{children}</LocaleContext.Provider>;
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

export function useBudgetFrequency(): BudgetFrequency {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useBudgetFrequency must be used within a LocaleProvider");
  return ctx.budgetFrequency;
}

/** The account's own period vocabulary (see lib/i18n/dictionary.ts's PeriodVocab) -- resolved from budgetFrequency, for client components that need a cadence-aware word ("quincena" vs "mes") without re-deriving it themselves. */
export function useVocab(): PeriodVocab {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useVocab must be used within a LocaleProvider");
  return ctx.vocab;
}
