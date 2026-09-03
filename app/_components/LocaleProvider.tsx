"use client";

import { createContext, useContext, useMemo } from "react";
import type { Dictionary, PeriodVocab } from "@/lib/i18n/dictionary";
import { getDictionary, resolveVocab } from "@/lib/i18n/get-dictionary";
import type { LocaleValue } from "@/lib/i18n/locale";
import type { PayFrequency } from "@/lib/quincena-pace";

/**
 * Takes only the resolved locale STRING and payFrequency STRING from the
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
  payFrequency: PayFrequency;
  vocab: PeriodVocab;
} | null>(null);

export function LocaleProvider({
  locale,
  payFrequency,
  children,
}: {
  locale: LocaleValue;
  payFrequency: PayFrequency;
  children: React.ReactNode;
}) {
  const t = useMemo(() => getDictionary(locale), [locale]);
  const vocab = useMemo(() => resolveVocab(t, payFrequency), [t, payFrequency]);
  return <LocaleContext.Provider value={{ locale, t, payFrequency, vocab }}>{children}</LocaleContext.Provider>;
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

export function usePayFrequency(): PayFrequency {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("usePayFrequency must be used within a LocaleProvider");
  return ctx.payFrequency;
}

/** The account's own period vocabulary (see lib/i18n/dictionary.ts's PeriodVocab) -- resolved from payFrequency, for client components that need a cadence-aware word ("quincena" vs "mes") without re-deriving it themselves. */
export function useVocab(): PeriodVocab {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useVocab must be used within a LocaleProvider");
  return ctx.vocab;
}
