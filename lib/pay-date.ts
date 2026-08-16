// Pure date helpers with no server-only imports, so client components
// (ConfirmJustGotPaidSheet's date picker, QuickAddSheet's date field) can
// import them directly without pulling lib/cycles.ts's Prisma dependency
// into the browser bundle.

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * Every "calendar day" Date this module hands out or accepts is anchored
 * to this one absolute instant: Panama midnight (05:00 UTC, since Panama
 * is UTC-5 year-round, no DST) for that Y/M/D — never "local midnight in
 * whichever machine happens to construct it." That distinction used to be
 * invisible (this app was only ever exercised from Vercel's UTC servers
 * and a Panama-timezone dev machine, and midnight in either of those
 * reads back as the correct day almost by coincidence), until it wasn't:
 * TransactionList.tsx reads a server-fetched CycleTransaction.occurredAt
 * (constructed server-side) back out *client-side*, in the user's own
 * browser, to pre-fill an edit sheet's date field. A Date built as "local
 * midnight" on one machine and read via local getters on a different one
 * can land on the wrong calendar day entirely — silently shifting a
 * transaction's date by a day the moment someone edited it, even without
 * touching the date field. Anchoring construction AND every read to
 * Panama's own timezone via Intl (see panamaDateParts below), instead of
 * whatever machine happens to be running the code, makes the round trip
 * correct everywhere, unconditionally — not just for the two environments
 * this app has happened to run on so far.
 */
function panamaMidnight(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day, 5, 0, 0));
}

/** Y/M/D as they fall in Panama's timezone for the given absolute instant — the read half of the panamaMidnight anchor above, used any time an existing Date needs its calendar day back (formatting, re-deriving "day only" from a stored value, the invalid-date round-trip check in parseDateOnly). */
function panamaDateParts(date: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Panama",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/**
 * The current wall-clock calendar day in Panama — NOT the server's (or
 * browser's) own local time. Any "what day is it" check — a default
 * pay/transaction date, a "not in the future" validation, a new cycle's
 * periodStart — needs this instead of the ambient system clock, whether
 * that check runs server-side or client-side.
 */
export function nowInPanama(): Date {
  const { year, month, day } = panamaDateParts(new Date());
  return panamaMidnight(year, month, day);
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

/**
 * "YYYY-MM-DD" label for the given date, as that date falls in Panama's
 * timezone — not the calling environment's own local timezone. Called
 * both server-side and client-side (including on a Date object fetched
 * server-side and re-formatted in the browser, e.g. TransactionList
 * pre-filling an edit sheet from a stored occurredAt), so it can never
 * assume "local" means Panama.
 */
export function formatCycleLabel(date: Date = nowInPanama()): string {
  const { year, month, day } = panamaDateParts(date);
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * Adds (or, with a negative count, subtracts) whole days to a
 * Panama-anchored Date, preserving its anchor -- Panama has no DST, so
 * every day is exactly 24 hours, making this safe regardless of which
 * timezone the calling machine is in. Used for the exclusive->inclusive
 * neighbor-boundary conversions in the pay-date-edit UI
 * (previousBoundDate/nextBoundDate).
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfDay(date: Date): Date {
  const { year, month, day } = panamaDateParts(date);
  return panamaMidnight(year, month, day);
}

/**
 * Parses "YYYY-MM-DD" into a Panama-midnight-anchored Date, rejecting
 * anything malformed or calendar-invalid (e.g. Feb 30, which JS would
 * otherwise silently roll over into Mar 2). No range check — callers
 * apply their own.
 */
export function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const date = panamaMidnight(year, month, day);
  const parts = panamaDateParts(date);
  if (Number.isNaN(date.getTime()) || parts.year !== year || parts.month !== month || parts.day !== day) {
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
