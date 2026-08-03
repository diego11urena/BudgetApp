/** The single source of truth for displaying money: $1,234.56, thousands separators, two decimals. */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
