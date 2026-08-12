export interface TransactionDateGroup<T> {
  label: string;
  items: T[];
}

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** "Today" / "Yesterday" / "Aug 1, 2026" — same short-date style used elsewhere in the app (e.g. a goal's ETA). */
export function formatGroupDateLabel(date: Date, now: Date = new Date()): string {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  if (isSameCalendarDay(date, now)) return "Today";
  if (isSameCalendarDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
