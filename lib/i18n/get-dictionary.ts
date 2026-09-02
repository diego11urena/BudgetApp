import type { Dictionary } from "./dictionary";
import { en } from "./dictionaries/en";
import { es } from "./dictionaries/es";
import type { LocaleValue } from "./locale";

const dictionaries: Record<LocaleValue, Dictionary> = { en, es };

export function getDictionary(locale: LocaleValue): Dictionary {
  return dictionaries[locale];
}
