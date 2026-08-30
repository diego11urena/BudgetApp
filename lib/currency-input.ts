/**
 * Shared math for CurrencyInput's implicit-decimal entry: every keystroke
 * is a digit appended to an integer number of cents (never a free-typed
 * decimal), so $1,250.50 is reached by typing "125050" -- the last two
 * digits are always cents. Kept here, not inline in the component, so the
 * arithmetic is independently unit-testable without rendering anything.
 */

// Matches decimalString's own cap (lib/validations/shared.ts): up to 10
// integer digits + 2 decimal digits, so a value built up here can never
// overflow a Decimal(12,2) column.
export const MAX_CURRENCY_DIGITS = 12;

/** Strips everything but 0-9, then keeps only the rightmost MAX_CURRENCY_DIGITS -- typing past the cap drops the oldest (leftmost) digit, same as a register rolling over, rather than silently refusing new input. */
export function digitsFromRawInput(raw: string): string {
  const digitsOnly = raw.replace(/\D/g, "");
  return digitsOnly.slice(-MAX_CURRENCY_DIGITS);
}

/** "45.5", "45.50", "45", "" -> integer cents (4550, 4550, 4500, 0). Rounds rather than truncates, so a stray third decimal digit from outside data never silently loses a cent. */
export function decimalStringToCents(value: string): number {
  const n = Number(value);
  if (!value || Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

/** Integer cents -> the app's existing "1234.56" storage/submission format. */
export function centsToDecimalString(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Integer cents -> what the input displays while typing: thousands separators, always exactly two decimals, no currency symbol (the field's own label already says "(USD)"). 125050 -> "1,250.50". */
export function centsToDisplay(cents: number): string {
  const dollars = Math.floor(cents / 100);
  const centsPart = String(cents % 100).padStart(2, "0");
  return `${dollars.toLocaleString("en-US")}.${centsPart}`;
}
