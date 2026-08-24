const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function calendarDaysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * A quincena's real length in days — 15 for a cycle starting in the first
 * half of the month (always true: day 1-15 is 15 days in every month), or
 * "days in this month minus 15" for one starting in the second half
 * (13-16 days depending on the month, not always 15 — the bug this fixes:
 * a 31-day month's second half is 16 days, a 28-day February's is only
 * 13). Applied relative to periodStart itself, not by snapping periodStart
 * to a canonical 1st/16th boundary — an edited or otherwise irregular
 * periodStart (see EditPayInfoSheet/ConfirmJustGotPaidSheet's lookback
 * window, which deliberately lets a payday land on any day) still gets a
 * sensible, non-zero runway instead of "your quincena already ended" just
 * because it happens to land late in a calendar half.
 */
export function quincenaLengthDays(periodStart: Date): number {
  const day = periodStart.getDate();
  if (day <= 15) return 15;
  return daysInMonth(periodStart.getFullYear(), periodStart.getMonth()) - 15;
}

/** The real calendar end of the quincena periodStart belongs to (inclusive). */
export function quincenaEnd(periodStart: Date): Date {
  const end = new Date(periodStart);
  end.setDate(end.getDate() + quincenaLengthDays(periodStart) - 1);
  return end;
}

/** The day after quincenaEnd — used to walk forward through consecutive real quincenas (see lib/goal-projection.ts). */
export function nextQuincenaStart(periodStart: Date): Date {
  const next = new Date(quincenaEnd(periodStart));
  next.setDate(next.getDate() + 1);
  return next;
}

export interface QuincenaPace {
  /** Days left in the quincena, including today. Always >= 0 (0 once the cycle has run past its nominal end). */
  daysRemaining: number;
  /** amountLeft / max(daysRemaining, 1) — the sustainable daily spend to stay on budget. */
  perDay: number;
  /** True on the last day of the quincena (daysRemaining <= 1) — show "Last day" copy instead of a per-day figure. */
  isLastDay: boolean;
  /** True when actual average daily spend so far is outpacing the sustainable per-day rate. */
  isOverPace: boolean;
}

/**
 * A cycle's periodEnd is only set when it's closed, so the nominal end of an
 * open quincena is derived from the calendar (see quincenaEnd), not read
 * from state.
 */
export function computeQuincenaPace(input: {
  periodStart: Date;
  now: Date;
  amountLeft: number;
  totalExpenses: number;
}): QuincenaPace {
  const { periodStart, now, amountLeft, totalExpenses } = input;

  const cycleEnd = quincenaEnd(periodStart);

  const daysRemaining = Math.max(calendarDaysBetween(now, cycleEnd) + 1, 0);
  const perDay = amountLeft / Math.max(daysRemaining, 1);

  const elapsedDays = Math.max(calendarDaysBetween(periodStart, now) + 1, 1);
  const avgDailySpendSoFar = totalExpenses / elapsedDays;
  const isOverPace = avgDailySpendSoFar > perDay;

  return {
    daysRemaining,
    perDay,
    isLastDay: daysRemaining <= 1,
    isOverPace,
  };
}
