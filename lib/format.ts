/** The single source of truth for displaying money: $1,234.56, thousands separators, two decimals. */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** The single source of truth for a friendly display date: "Aug 11, 2026" — a goal's ETA, a transaction-list date-group header, a History entry. Not for "YYYY-MM-DD" form fields/labels (see lib/pay-date.ts's formatCycleLabel for that). */
export function formatFriendlyDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
