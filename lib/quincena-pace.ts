// Every day-boundary read/write here is Panama-anchored via lib/pay-date.ts
// (startOfDay, panamaDateParts, addDays), never a Date's own local getters
// (.getFullYear()/.getMonth()/.getDate()) or setters -- periodStart is
// itself a Panama-midnight-anchored instant (see pay-date.ts's own top
// comment), and reading it back with LOCAL getters on any machine west of
// UTC-5 (i.e. most of the US) lands on the wrong calendar day, silently
// running every quincena-length/days-remaining calculation a day early.
// lib/pay-date.ts documents and fixes this exact class of bug already;
// this file used to reimplement its own (broken) local version instead of
// importing that fix.
import { addDays, panamaDateParts, startOfDay } from "./pay-date";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function calendarDaysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}

// `month` here is 0-indexed, matching Date's own constructor convention
// (new Date(year, month, day)) -- callers translate from panamaDateParts'
// 1-indexed month before calling this, see quincenaLengthDays below.
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
  const { year, month, day } = panamaDateParts(periodStart);
  if (day <= 15) return 15;
  return daysInMonth(year, month - 1) - 15;
}

/** The real calendar end of the quincena periodStart belongs to (inclusive). */
export function quincenaEnd(periodStart: Date): Date {
  return addDays(periodStart, quincenaLengthDays(periodStart) - 1);
}

/** The day after quincenaEnd — used to walk forward through consecutive real quincenas (see lib/goal-projection.ts). */
export function nextQuincenaStart(periodStart: Date): Date {
  return addDays(quincenaEnd(periodStart), 1);
}

/**
 * Where a quincena's pace actually stands right now — "running" for any
 * day with more than one left, "last-day" for exactly one day left (a
 * per-day rate would just repeat the hero number, so the UI shows a
 * different line instead), and "ended" once the cycle has run past its
 * nominal end without the user closing it yet (getOrCreateDraftCycle keeps
 * a cycle open indefinitely — this is the state that should prompt "I just
 * got paid," not repeat a "last day" claim that's no longer true).
 */
export type PacePhase = "running" | "last-day" | "ended";

export interface QuincenaPace {
  /** Days left in the quincena, including today. Always >= 0 (0 once the cycle has run past its nominal end). */
  daysRemaining: number;
  /** amountLeft / max(daysRemaining, 1) — the sustainable daily spend to stay on budget. */
  perDay: number;
  /** running / last-day / ended — see PacePhase. */
  phase: PacePhase;
  /** Derived from phase (phase === "last-day") -- kept alongside phase for existing callers rather than removed, since "phase" alone is the more precise signal (it also distinguishes the "ended" case this boolean used to fold into "last day" too). */
  isLastDay: boolean;
  /** The resolved end-of-cycle date this pace was computed against (periodEnd if provided, else the calendar-derived quincenaEnd) -- surfaced so callers needing to *display* that date (e.g. "Quincena ended {date}") don't have to re-derive it themselves. */
  cycleEnd: Date;
  /** True when actual average daily spend so far is outpacing the sustainable per-day rate. */
  isOverPace: boolean;
}

/**
 * A cycle's periodEnd is only ever set once it's closed (see
 * lib/cycles.ts) -- for any still-open cycle it's null, and the nominal
 * end is derived from the calendar instead (quincenaEnd). Preferring
 * periodEnd when present (rather than always deriving from the calendar)
 * matters once a payday has been edited: formatCycleRangeText and
 * insights.ts already prefer periodEnd the same way, and without this,
 * editing a pay date would make Home's own "N days remaining" disagree
 * with the date range the header shows for the very same cycle.
 */
export function computeQuincenaPace(input: {
  periodStart: Date;
  periodEnd?: Date | null;
  now: Date;
  amountLeft: number;
  totalExpenses: number;
}): QuincenaPace {
  const { periodStart, periodEnd, now, amountLeft, totalExpenses } = input;

  const cycleEnd = periodEnd ?? quincenaEnd(periodStart);

  const daysRemaining = Math.max(calendarDaysBetween(now, cycleEnd) + 1, 0);
  const perDay = amountLeft / Math.max(daysRemaining, 1);

  const elapsedDays = Math.max(calendarDaysBetween(periodStart, now) + 1, 1);
  const avgDailySpendSoFar = totalExpenses / elapsedDays;
  const isOverPace = avgDailySpendSoFar > perDay;

  const phase: PacePhase = daysRemaining === 0 ? "ended" : daysRemaining === 1 ? "last-day" : "running";

  return {
    daysRemaining,
    perDay,
    phase,
    isLastDay: phase === "last-day",
    cycleEnd,
    isOverPace,
  };
}
