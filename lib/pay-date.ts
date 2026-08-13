// Pure date helpers with no server-only imports, so client components
// (ConfirmJustGotPaidSheet's date picker, QuickAddSheet's date field) can
// import them directly without pulling lib/cycles.ts's Prisma dependency
// into the browser bundle.

function pad(n: number): string {
  return n.toString().padStart(2, "0");
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
export function parsePayDate(value: string, now: Date = new Date()): Date | null {
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
export function parseTransactionDate(value: string, cycleStart: Date, now: Date = new Date()): Date | null {
  const date = parseDateOnly(value);
  if (!date) return null;

  const today = startOfDay(now);
  const earliest = startOfDay(cycleStart);

  if (date.getTime() > today.getTime() || date.getTime() < earliest.getTime()) {
    return null;
  }
  return date;
}
