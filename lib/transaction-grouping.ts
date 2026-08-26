import { formatFriendlyDate } from "./format";
import { addDays, panamaDateParts } from "./pay-date";

export interface TransactionDateGroup<T> {
  label: string;
  items: T[];
}

// Panama-anchored (not the machine's local Date getters) — a transaction
// logged just after Panama midnight must still land in "Today"'s bucket
// even when this runs on a UTC or other-timezone server (see
// lib/pay-date.ts's own top comment for why raw local getters on a
// server-constructed Date are the wrong tool here; same class of bug
// lib/quincena-pace.ts had before it was fixed).
function isSameCalendarDay(a: Date, b: Date): boolean {
  const aParts = panamaDateParts(a);
  const bParts = panamaDateParts(b);
  return aParts.year === bParts.year && aParts.month === bParts.month && aParts.day === bParts.day;
}

/** "Today" / "Yesterday" / "Aug 1, 2026" — lib/format.ts's formatFriendlyDate for anything older. */
export function formatGroupDateLabel(date: Date, now: Date = new Date()): string {
  if (isSameCalendarDay(date, now)) return "Today";
  if (isSameCalendarDay(date, addDays(now, -1))) return "Yesterday";
  return formatFriendlyDate(date);
}

/**
 * Groups already-sorted transactions into consecutive same-day buckets.
 * Assumes the input is ordered so each date's rows are contiguous (true
 * for a date-based sort) — the caller skips grouping entirely for an
 * amount-based sort, where same-day rows aren't contiguous.
 */
export function groupTransactionsByDate<T extends { occurredAt: Date }>(
  items: T[],
  now: Date = new Date(),
): TransactionDateGroup<T>[] {
  const groups: TransactionDateGroup<T>[] = [];
  for (const item of items) {
    const label = formatGroupDateLabel(item.occurredAt, now);
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.label === label) {
      lastGroup.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }
  }
  return groups;
}
