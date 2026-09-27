import { resolveMonthlyDueDate } from "./pay-date";
import { calendarDaysBetween } from "./quincena-pace";
import type { CategoryWithRecurringExpenses } from "./recurring-expenses";

/**
 * The single most urgent still-unpaid Scheduled item, named so a person
 * can act on it without opening every row -- same "name the one that
 * matters" framing lib/insights.ts's dueSoonCandidate already uses, just
 * surfaced here instead of (or in addition to) the Insights card.
 */
export interface RecurringFulfillmentException {
  name: string;
  kind: "missing" | "upcoming";
  /** Null when dueDay doesn't resolve this month (e.g. 31st in a 30-day month) -- see resolveMonthlyDueDate. */
  dueDate: Date | null;
}

export interface ScheduledFulfillment {
  chargedOnTime: number;
  total: number;
  exception: RecurringFulfillmentException | null;
}

export interface OngoingFulfillment {
  /** Alphabetical -- joined "A, B and C" at the display layer via Intl.ListFormat, not here (that's locale-specific presentation, not data). */
  loggedNames: string[];
}

export interface RecurringFulfillment {
  scheduled: ScheduledFulfillment;
  ongoing: OngoingFulfillment;
}

/**
 * Shared by Summary's Recurring section and Breakdown's chapter 02 -- one
 * function so the two screens can never disagree about "7 of 8 charged
 * on time" or which item is the named exception. Deliberately its own
 * file rather than living in lib/breakdown-v2.ts (Summary needs it too,
 * and "breakdown" naming would mislead) or lib/recurring-expenses.ts
 * (that file's charter is producing the CategoryWithRecurringExpenses
 * data model itself -- narrative framing for these two specific screens
 * is a layer on top, the same way lib/insights.ts and lib/summary.ts
 * already sit on top of it without living inside it).
 *
 * chargedOnTime counts Scheduled items with status !== "not-started" --
 * i.e. *some* payment has landed, even if under or over target. That's a
 * different question from "paid in full" (which summarizeRecurringExpenses
 * already answers for the Recurring tab's own progress bar) -- "charged"
 * is about whether the bill showed up at all, not whether the amount
 * matches.
 */
export function summarizeRecurringFulfillment(categories: CategoryWithRecurringExpenses[], now: Date): RecurringFulfillment {
  let total = 0;
  let chargedOnTime = 0;
  const notStarted: { name: string; dueDay: number | null }[] = [];
  const loggedOngoing: string[] = [];

  for (const category of categories) {
    for (const expense of category.expenses) {
      if (expense.hasFixedDate) {
        total++;
        if (expense.status === "not-started") {
          notStarted.push({ name: expense.name, dueDay: expense.dueDay });
        } else {
          chargedOnTime++;
        }
      } else if (expense.status === "logged") {
        loggedOngoing.push(expense.name);
      }
    }
  }

  let exception: RecurringFulfillmentException | null = null;
  if (notStarted.length > 0) {
    let best: { name: string; dueDate: Date | null; rank: number } | null = null;
    for (const item of notStarted) {
      const dueDate = item.dueDay !== null ? resolveMonthlyDueDate(now, item.dueDay) : null;
      // Most-overdue first (most negative rank), then soonest-upcoming;
      // an unresolvable dueDay (Infinity) sorts last -- named only if
      // nothing with a real date is also waiting.
      const rank = dueDate ? calendarDaysBetween(now, dueDate) : Infinity;
      if (!best || rank < best.rank) best = { name: item.name, dueDate, rank };
    }
    if (best) {
      exception = {
        name: best.name,
        // <= 0, not < 0 -- matches lib/insights.ts's own overdue convention
        // (unpaidRecurringCandidate's hasOverdue is daysUntilDue <= 0): a
        // bill due today and not yet charged reads as "hasn't shown up
        // yet," not "due today," once today has actually arrived.
        kind: best.rank <= 0 ? "missing" : "upcoming",
        dueDate: best.dueDate,
      };
    }
  }

  return {
    scheduled: { chargedOnTime, total, exception },
    ongoing: { loggedNames: loggedOngoing.sort((a, b) => a.localeCompare(b)) },
  };
}
