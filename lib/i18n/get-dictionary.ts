import type { Dictionary, PeriodVocab } from "./dictionary";
import { en } from "./dictionaries/en";
import { es } from "./dictionaries/es";
import type { LocaleValue } from "./locale";
import type { BudgetFrequency } from "../quincena-pace";

const dictionaries: Record<LocaleValue, Dictionary> = { en, es };

export function getDictionary(locale: LocaleValue): Dictionary {
  return dictionaries[locale];
}

/** The one place server components resolve a budgetFrequency into its PeriodVocab -- mirrors LocaleProvider's own client-side resolution (see its useVocab hook) so server and client never disagree on the mapping. */
export function resolveVocab(t: Dictionary, budgetFrequency: BudgetFrequency): PeriodVocab {
  return t.periodVocab[budgetFrequency === "MONTHLY" ? "monthly" : "quincenal"];
}
