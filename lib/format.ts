/** The single source of truth for displaying money: $1,234.56, thousands separators, two decimals. */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/**
 * The single source of truth for a friendly display date: "Aug 11, 2026" —
 * a goal's ETA, a transaction-list date-group header, a History entry. Not
 * for "YYYY-MM-DD" form fields/labels (see lib/pay-date.ts's
 * formatCycleLabel for that).
 *
 * Explicit `timeZone: "America/Panama"` -- without it, `toLocaleDateString`
 * reads the calling machine's own local timezone, which only agreed with
 * Panama's calendar day because this app has only ever run from Vercel's
 * UTC servers (where midnight-anchored Panama Dates round-trip correctly
 * by coincidence) or a Panama-timezone dev machine.
 */
export function formatFriendlyDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Panama",
  });
}

/**
 * Home's header subline -- "Aug 16 – Aug 31", a quincena's date range with
 * no year (unlike formatFriendlyDate: a 2-week range is always read in the
 * context of "this/last quincena," so the year would just be noise).
 */
export function formatCycleRangeLabel(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "America/Panama" };
  return `${start.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", opts)}`;
}
