import type { LocaleValue } from "./i18n/locale";

/**
 * This app's own locale value ("en" | "es") mapped to the BCP 47 tag Intl
 * wants. Dates were formatted with a hardcoded "en-US" everywhere, so a
 * Spanish user read "Aug 16 - Aug 31" and "Oct 2" throughout an otherwise
 * fully translated app -- the dictionary cannot catch that, because the
 * month names never passed through it.
 *
 * "es-ES" rather than "es-PA": both render the month names identically,
 * and es-ES is what formatMonthLabel below already used, so this keeps one
 * answer for the whole file.
 *
 * Defaulting to "en" keeps every existing call site compiling and
 * behaving exactly as before; the callers that have a locale in hand pass
 * it.
 */
function intlLocale(locale: LocaleValue): string {
  return locale === "es" ? "es-ES" : "en-US";
}

/** The single source of truth for displaying money: $1,234.56, thousands separators, two decimals. */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/**
 * Whole dollars, no cents: "$594". The design system reserves this for
 * display headlines specifically ("Currency always $1,234.56; headlines
 * use whole dollars"), where the cents are noise against a 44px figure --
 * every other figure on the same screen, including the stat row directly
 * beneath the headline, still shows cents via formatCurrency above.
 */
export function formatWholeDollars(amount: number): string {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
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
export function formatFriendlyDate(date: Date, locale: LocaleValue = "en"): string {
  return date.toLocaleDateString(intlLocale(locale), {
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
export function formatCycleRangeLabel(start: Date, end: Date, locale: LocaleValue = "en"): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", timeZone: "America/Panama" };
  const tag = intlLocale(locale);
  return `${start.toLocaleDateString(tag, opts)} – ${end.toLocaleDateString(tag, opts)}`;
}

/**
 * A single date, no year -- "Aug 28". Same no-year reasoning as
 * formatCycleRangeLabel (one endpoint instead of two): used for a
 * recurring expense's due date ("Internet is due Aug 30") and Biggest
 * Transactions' per-row date, both always read as "within this/last
 * cycle," never far enough back for the year to matter.
 */
export function formatShortDate(date: Date, locale: LocaleValue = "en"): string {
  return date.toLocaleDateString(intlLocale(locale), { month: "short", day: "numeric", timeZone: "America/Panama" });
}

/**
 * A bare month name -- "May" / "mayo" -- for Summary's "your lightest
 * since {month}" context line (lib/summary.ts's computeSpendComparison
 * hands back the raw Date; this app's own convention is that locale-
 * dependent formatting happens client-side via useLocale(), the same way
 * RecurringFulfillmentCard picks its Intl.ListFormat locale -- see that
 * component's own comment -- rather than a server component baking in
 * one language, unlike this file's other formatters (formatCurrency,
 * formatFriendlyDate, formatCycleRangeLabel), which are deliberately
 * locale-fixed for reasons specific to each (currency symbols, date
 * conventions). A full "Month Year" isn't needed here -- the surrounding
 * sentence only ever means "the most recent time," never a date more
 * than a few cycles back where the year would matter.
 */
export function formatMonthLabel(date: Date, locale: "en" | "es"): string {
  return date.toLocaleDateString(locale === "es" ? "es-ES" : "en-US", { month: "long", timeZone: "America/Panama" });
}
