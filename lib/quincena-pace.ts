const QUINCENA_DAYS = 15;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function calendarDaysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
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
 * open quincena is derived as periodStart + 15 days (day 1..15), not read
 * from state.
 */
export function computeQuincenaPace(input: {
  periodStart: Date;
  now: Date;
  amountLeft: number;
  totalExpenses: number;
}): QuincenaPace {
  const { periodStart, now, amountLeft, totalExpenses } = input;

  const cycleEnd = new Date(periodStart);
  cycleEnd.setDate(cycleEnd.getDate() + QUINCENA_DAYS - 1);

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
