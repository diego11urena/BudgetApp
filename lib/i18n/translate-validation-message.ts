import type { Dictionary } from "./dictionary";
import { en } from "./dictionaries/en";

/**
 * Zod schemas (lib/validations/*.ts) keep their literal English messages
 * as-is -- rewriting every schema into a locale-aware factory would touch
 * every call site for a closed, already-cataloged set of ~13 messages.
 * Instead: look up the English message a schema just produced against
 * english's own dictionary values, and hand back the resolved locale's
 * equivalent. A message that isn't in this table (shouldn't happen, since
 * this list mirrors lib/i18n/dictionary.ts's `validations` group exactly)
 * passes through untranslated rather than throwing.
 */
export function translateValidationMessage(message: string, t: Dictionary): string {
  const enV = en.validations;
  const tV = t.validations;
  const map: Record<string, string> = {
    [enV.invalidAmount]: tV.invalidAmount,
    [enV.amountNotPositive]: tV.amountNotPositive,
    [enV.giveItAName]: tV.giveItAName,
    [enV.nameRequired]: tV.nameRequired,
    [enV.invalidEmail]: tV.invalidEmail,
    [enV.passwordMinLength]: tV.passwordMinLength,
    [enV.passwordMaxLength]: tV.passwordMaxLength,
    [enV.passwordRequired]: tV.passwordRequired,
    [enV.currentPasswordRequired]: tV.currentPasswordRequired,
    [enV.newPasswordMinLength]: tV.newPasswordMinLength,
    [enV.newPasswordMaxLength]: tV.newPasswordMaxLength,
    [enV.amountTooLarge]: tV.amountTooLarge,
    [enV.dueDayRequiredForMonthly]: tV.dueDayRequiredForMonthly,
  };
  return map[message] ?? message;
}
