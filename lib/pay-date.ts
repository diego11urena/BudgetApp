// Pure date helpers with no server-only imports, so client components
// (ConfirmJustGotPaidSheet's date picker, QuickAddSheet's date field) can
// import them directly without pulling lib/cycles.ts's Prisma dependency
// into the browser bundle.

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * The current wall-clock moment in Panama (UTC-5 year-round, no DST) —
 * NOT the server's own local time. Vercel's serverless functions run in
 * UTC, so plain `new Date()` on the server reads a calendar day ahead of
 * Panama for roughly 5 hours every evening (Panama's ~7pm-midnight,
 * before UTC has caught up to Panama's midnight). Any server-side "what
 * day is it" check — a default pay/transaction date, a "not in the
 * future" validation, a new cycle's periodStart — needs this instead of
 * the ambient system clock. Client components don't: `new Date()` in the
 * browser already reflects wherever the user actually is.
 *
 * Returns Panama's wall-clock calendar day as a local midnight Date
 * (matching every other date in this module, which are all "local
 * calendar day" values regardless of which machine's timezone originally
 * constructed them) — every consumer here only ever needs day-granularity
 * "what day is it", never the exact hour.
 */
export function nowInPanama(): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Panama",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return new Date(get("year"), get("month") - 1, get("day"));
}

/**
 * Panama's current wall-clock hour (0-23) — separate from nowInPanama()
 * since that intentionally zeroes out the time-of-day for day-boundary
 * comparisons. Used for genuinely time-of-day-sensitive things (a "good
 * morning/afternoon/evening" greeting), not date math.
 */
export function hourInPanama(): number {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Panama",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  return Number(hour.find((p) => p.type === "hour")?.value);
}

/** "YYYY-MM-DD" label for the given date — a cycle's start date, for display. */
export function formatCycleLabel(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Parses "YYYY-MM-DD" into a local midnight Date, rejecting anything
 * malformed or calendar-invalid (e.g. Feb 30, which JS would otherwise
 * silently roll over into Mar 2). No range check — callers apply their own.
 */
export function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const [, yearStr, monthStr, dayStr] = match;
  const date = new Date(Number(yearStr), Number(monthStr) - 1, Number(dayStr));
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== Number(yearStr) ||
    date.getMonth() !== Number(monthStr) - 1 ||
    date.getDate() !== Number(dayStr)
  ) {
    return null;
  }
  return date;
}

/** How far back "When did you get paid?" allows — see ConfirmJustGotPaidSheet. */
export const PAY_DATE_LOOKBACK_DAYS = 7;

/**
 * Parses "When did you get paid?"'s date input ("YYYY-MM-DD"), rejecting
 * anything outside [today - PAY_DATE_LOOKBACK_DAYS, today] — the input's
 * own min/max already constrain this in the browser, this is the
 * server-side backstop against a tampered request. Returns null for
 * anything malformed or out of range, letting the caller fall back to
 * "now" rather than fail the whole close-cycle action over a bad date.
 */
export function parsePayDate(value: string, now: Date = nowInPanama()): Date | null {
  const date = parseDateOnly(value);
  if (!date) return null;

  const today = startOfDay(now);
  const earliest = new Date(today);
  earliest.setDate(earliest.getDate() - PAY_DATE_LOOKBACK_DAYS);

  if (date.getTime() > today.getTime() || date.getTime() < earliest.getTime()) {
    return null;
  }
  return date;
}

/**
 * Parses a manually-logged transaction's date field, bounded to
 * [cycleStart, today] — can't predate the currently open quincena (its
 * history is what "This quincena" reporting is built from) and can't be in
 * the future. Same malformed/out-of-range -> null contract as parsePayDate.
 */
export function parseTransactionDate(value: string, cycleStart: Date, now: Date = nowInPanama()): Date | null {
  const date = parseDateOnly(value);
  if (!date) return null;

  const today = startOfDay(now);
  const earliest = startOfDay(cycleStart);

  if (date.getTime() > today.getTime() || date.getTime() < earliest.getTime()) {
    return null;
  }
  return date;
}
