"use client";

// Persists "Not this one" dismissals for a recurring-expense match
// suggestion across visits -- previously local component state only, so
// the exact same wrong suggestion reappeared on every page load. Keyed by
// (recurringExpenseId, transactionId) together, not the recurring expense
// alone, so dismissing one specific bad guess doesn't silently suppress a
// genuinely different suggestion that shows up later (e.g. once a newer
// unlinked transaction becomes the better candidate).
const STORAGE_KEY = "balboa:dismissed-matches";

function matchKey(recurringExpenseId: string, transactionId: string): string {
  return `${recurringExpenseId}:${transactionId}`;
}

function readAll(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function isMatchDismissed(recurringExpenseId: string, transactionId: string): boolean {
  return readAll().has(matchKey(recurringExpenseId, transactionId));
}

export function dismissMatch(recurringExpenseId: string, transactionId: string): void {
  if (typeof window === "undefined") return;
  const all = readAll();
  all.add(matchKey(recurringExpenseId, transactionId));
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...all]));
  } catch {
    // Storage full/disabled -- the dismissal just won't persist across a
    // reload; not worth surfacing an error to the user for.
  }
}
