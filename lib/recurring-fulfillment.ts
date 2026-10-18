import { resolveMonthlyDueDate } from "./pay-date";
import { calendarDaysBetween } from "./quincena-pace";
import type { CategoryWithRecurringExpenses } from "./recurring-expenses";

/**
 * The single most urgent still-unpaid recurring item, named so a person
 * can act on it without opening every row -- same "name the one that
 * matters" framing lib/insights.ts's dueSoonCandidate already uses, just
 * surfaced here instead of (or in addition to) the Insights card.
 */
export interface RecurringFulfillmentException {
  name: string;
  kind: "missing" | "upcoming";
  /** Null for an item with no set date, or a dueDay that doesn't resolve this month (see resolveMonthlyDueDate). */
  dueDate: Date | null;
}

export interface RecurringFulfillment {
  chargedOnTime: number;
  total: number;
  exception: RecurringFulfillmentException | null;
}

/**
 * Shared by Summary's Recurring section and Breakdown's chapter 02 -- one
 * function so the two screens can never disagree about "7 of 8 charged
 * on time" or which item is the named exception.
 *
 * Counts only items charged this cycle (see chargedThisCycle). chargedOnTime
 * counts those with status !== "not-started" -- i.e. *some* payment has
 * landed, even if under or over target. That's a different question from
 * "paid in full" (which summarizeRecurringExpenses already answers for the
 * Plan tab's own progress bar) -- "charged" is about whether the bill
 * showed up at all, not whether the amount matches.
 */
/**
 * `asOf` is the moment the period is being judged from, NOT necessarily
 * today. It decides two things: which month's occurrence of a dueDay
 * resolves, and whether an uncharged item ranks as "missing" (already
 * past its date) or "upcoming" (still ahead of it).
 *
 * For a LIVE period that is today. For a CLOSED one it must be the
 * cycle's own end: a cycle that closed in August and is opened in
 * October would otherwise resolve its due days against October and rank
 * everything against today, so a bill that was never charged in August
 * reads as "upcoming" -- due later this month -- when the period it
 * belongs to ended two months ago and nothing more can arrive in it.
 */
export function summarizeRecurringFulfillment(
  categories: CategoryWithRecurringExpenses[],
  asOf: Date,
): RecurringFulfillment {
  let total = 0;
  let chargedOnTime = 0;
  const notStarted: { name: string; dueDay: number | null }[] = [];

  for (const category of categories) {
    for (const expense of category.expenses) {
      if (!expense.chargedThisCycle) continue;
      total++;
      if (expense.status === "not-started") {
        notStarted.push({ name: expense.name, dueDay: expense.dueDay });
      } else {
        chargedOnTime++;
      }
    }
  }

  let exception: RecurringFulfillmentException | null = null;
  if (notStarted.length > 0) {
    let best: { name: string; dueDate: Date | null; rank: number } | null = null;
    for (const item of notStarted) {
      const dueDate = item.dueDay !== null ? resolveMonthlyDueDate(asOf, item.dueDay) : null;
      // Most-overdue first (most negative rank), then soonest-upcoming;
      // an item with no date (Infinity) sorts last -- named only if
      // nothing with a real date is also waiting.
      const rank = dueDate ? calendarDaysBetween(asOf, dueDate) : Infinity;
      if (!best || rank < best.rank) best = { name: item.name, dueDate, rank };
    }
    if (best) {
      exception = {
        name: best.name,
        // <= 0, not < 0 -- matches lib/insights.ts's own overdue convention
        // (unpaidRecurringCandidate's hasOverdue is daysUntilDue <= 0): a
        // bill due today and not yet charged reads as "hasn't shown up
        // yet," not "due today," once asOf has actually reached it.
        // No date to be "due" on: it simply hasn't shown up yet.
        kind: best.rank <= 0 || best.dueDate === null ? "missing" : "upcoming",
        dueDate: best.dueDate,
      };
    }
  }

  return { chargedOnTime, total, exception };
}
