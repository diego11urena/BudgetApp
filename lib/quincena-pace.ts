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
import { addDays, panamaDateParts, panamaMidnight, startOfDay } from "./pay-date";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Mirrors the Prisma BudgetFrequency enum's own string values exactly (no
// lowercase mapping the way lib/theme.ts's ThemePreferenceValue does --
// that one's lowercase for cookie-friendliness; this type never touches
// a cookie, so there's no reason to diverge from the DB's own casing).
// Defined locally rather than imported from the generated Prisma client
// so this file -- pure calendar arithmetic -- stays decoupled from
// Prisma, the same discipline lib/pay-date.ts documents at its own top.
export type BudgetFrequency = "QUINCENAL" | "MONTHLY";

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
 * The real calendar end of the one-month cycle periodStart belongs to
 * (inclusive) — one calendar month out from periodStart's own day, e.g.
 * a periodStart of Aug 16 ends Sep 15 (the day before Sep 16), the same
 * "anchored to the actual pay date, not the 1st" convention
 * closeCycleAndStartNext already uses for periodStart itself. When
 * periodStart's day-of-month doesn't exist in the following month (e.g.
 * Jan 31 has no Feb 31), clamps to that month's real last day rather
 * than overflowing into the month after — the same "same day next
 * month" resolution every calendar app uses for the 29th–31st.
 */
export function monthEnd(periodStart: Date): Date {
  const { year, month, day } = panamaDateParts(periodStart);
  const nextMonth1 = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const clampedDay = Math.min(day, daysInMonth(nextYear, nextMonth1 - 1));
  const nextOccurrence = panamaMidnight(nextYear, nextMonth1, clampedDay);
  return addDays(nextOccurrence, -1);
}

/** A monthly cycle's real length in days — derived from monthEnd, mirroring how quincenaEnd is derived FROM quincenaLengthDays (the reverse direction), since walking the calendar month-by-month is the more natural way to land on a correct end date here, including the 29th–31st clamping case. */
export function monthLengthDays(periodStart: Date): number {
  return calendarDaysBetween(periodStart, monthEnd(periodStart)) + 1;
}

/**
 * The one place every caller should go through instead of calling
 * quincenaEnd/monthEnd directly — dispatches on the account's own
 * budgetFrequency so cycle-boundary/pace/carry-forward logic never has to
 * branch on cadence itself, just call these.
 */
export function cycleEnd(periodStart: Date, frequency: BudgetFrequency): Date {
  return frequency === "MONTHLY" ? monthEnd(periodStart) : quincenaEnd(periodStart);
}

export function cycleLengthDays(periodStart: Date, frequency: BudgetFrequency): number {
  return frequency === "MONTHLY" ? monthLengthDays(periodStart) : quincenaLengthDays(periodStart);
}

/** The day after cycleEnd — used to walk forward through consecutive real cycles (see lib/goal-projection.ts). Generalizes nextQuincenaStart to either cadence. */
export function nextCycleStart(periodStart: Date, frequency: BudgetFrequency): Date {
  return addDays(cycleEnd(periodStart, frequency), 1);
}

/**
 * Whether a given day-of-month (a recurring bill's dueDay) has an
 * occurrence falling within [periodStart, cycleEnd(periodStart, frequency)]
 * (inclusive both ends). Checks the day's occurrence in periodStart's own
 * month and the following month -- the only two months a cycle of at most
 * ~31 days can ever span -- clamping each to that month's real last day the
 * same way monthEnd does (so a dueDay of 31 still matches a 30-day month's
 * last day instead of never matching).
 *
 * Replaces the old "which half of the month" bucket comparison
 * (quincenaForDay(dueDay) === quincenaForDay(newCycle's day)), which only
 * ever worked because a quincena cycle happens to roughly line up with the
 * calendar's 1-15/16-31 halves. This checks real date containment instead:
 * for a QUINCENAL cycle (~15 days) a given day-of-month still falls inside
 * exactly one of the month's two cycles, reproducing the old behavior
 * exactly; for a MONTHLY cycle (spanning the whole month) every day 1-31
 * falls inside it, so a MONTHLY-frequency bill now correctly carries into
 * every cycle -- the only sane behavior once a cycle IS the month.
 */
export function dueDayFallsWithinCycle(dueDay: number, periodStart: Date, frequency: BudgetFrequency): boolean {
  const rangeStart = startOfDay(periodStart).getTime();
  const rangeEnd = startOfDay(cycleEnd(periodStart, frequency)).getTime();

  const { year, month } = panamaDateParts(periodStart);
  const nextMonth1 = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const occurrences = [
    panamaMidnight(year, month, Math.min(dueDay, daysInMonth(year, month - 1))),
    panamaMidnight(nextYear, nextMonth1, Math.min(dueDay, daysInMonth(nextYear, nextMonth1 - 1))),
  ];

  return occurrences.some((d) => d.getTime() >= rangeStart && d.getTime() <= rangeEnd);
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
  /** 0 (cycle just started) to 1 (today is the last day) -- drives the Home hero card's cycle-elapsed progress bar. Clamped to 1 rather than growing past it once a cycle runs stale (getOrCreateDraftCycle keeps a cycle open past its nominal end until the user closes it). */
  elapsedFraction: number;
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
export function computeCyclePace(input: {
  periodStart: Date;
  periodEnd?: Date | null;
  now: Date;
  amountLeft: number;
  totalExpenses: number;
  frequency: BudgetFrequency;
}): QuincenaPace {
  const { periodStart, periodEnd, now, amountLeft, totalExpenses, frequency } = input;

  const resolvedCycleEnd = periodEnd ?? cycleEnd(periodStart, frequency);

  const daysRemaining = Math.max(calendarDaysBetween(now, resolvedCycleEnd) + 1, 0);
  const perDay = amountLeft / Math.max(daysRemaining, 1);

  const elapsedDays = Math.max(calendarDaysBetween(periodStart, now) + 1, 1);
  const avgDailySpendSoFar = totalExpenses / elapsedDays;
  const isOverPace = avgDailySpendSoFar > perDay;

  const phase: PacePhase = daysRemaining === 0 ? "ended" : daysRemaining === 1 ? "last-day" : "running";

  // Derived from the SAME resolvedCycleEnd used above (rather than a fresh
  // quincenaLengthDays(periodStart) call) so this stays consistent once a
  // payday edit gives a cycle a real periodEnd that diverges from the
  // calendar formula -- see cycleEnd/daysRemaining's own doc comment.
  const totalDays = calendarDaysBetween(periodStart, resolvedCycleEnd) + 1;
  const elapsedFraction = Math.min(elapsedDays / totalDays, 1);

  return {
    daysRemaining,
    perDay,
    phase,
    isLastDay: phase === "last-day",
    cycleEnd: resolvedCycleEnd,
    isOverPace,
    elapsedFraction,
  };
}
