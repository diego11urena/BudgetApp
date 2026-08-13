// Pure date helpers with no server-only imports, so client components
// (ConfirmJustGotPaidSheet's date picker) can import them directly without
// pulling lib/cycles.ts's Prisma dependency into the browser bundle.

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** "YYYY-MM-DD" label for the given date — a cycle's start date, for display. */
export function formatCycleLabel(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** How far back "When did you get paid?" allows — see ConfirmJustGotPaidSheet. */
export const PAY_DATE_LOOKBACK_DAYS = 7;

/**
 * Parses "When did you get paid?"'s date input ("YYYY-MM-DD") into a local
 * midnight Date, rejecting anything outside [today - PAY_DATE_LOOKBACK_DAYS,
 * today] — the input's own min/max already constrain this in the browser,
 * this is the server-side backstop against a tampered request. Returns null
 * for anything malformed or out of range, letting the caller fall back to
 * "now" rather than fail the whole close-cycle action over a bad date.
 */
export function parsePayDate(value: string, now: Date = new Date()): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const [, yearStr, monthStr, dayStr] = match;
  const date = new Date(Number(yearStr), Number(monthStr) - 1, Number(dayStr));
  // Catches both an unparseable string and a rolled-over value like Feb 30
  // (JS normalizes that to Mar 2 instead of erroring — reject it instead).
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== Number(yearStr) ||
    date.getMonth() !== Number(monthStr) - 1 ||
    date.getDate() !== Number(dayStr)
  ) {
    return null;
  }

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const earliest = new Date(today);
  earliest.setDate(earliest.getDate() - PAY_DATE_LOOKBACK_DAYS);

  if (date.getTime() > today.getTime() || date.getTime() < earliest.getTime()) {
    return null;
  }

  return date;
}
