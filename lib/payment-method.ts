import type { PaymentMethod } from "@/app/generated/prisma/client";

export type { PaymentMethod };

/**
 * The canonical list, order, and copy for every payment-method
 * picker/filter/display/schema in the app — previously re-typed by hand in
 * QuickAddSheet, RecordPaymentSheet, TransactionFilters,
 * TransactionList, transactions/page.tsx, _actions/transactions.ts, and
 * lib/cycle-financials.ts, with the order and copy drifting slightly
 * between copies. Prisma's own generated `PaymentMethod` type import
 * (type-only, so it costs nothing in a client bundle) is the source of
 * truth for the *values*; this module owns their display order and labels.
 */
export const PAYMENT_METHODS = ["CASH", "CREDIT_CARD", "DEBIT_CARD", "YAPPY", "ACH"] as const satisfies readonly PaymentMethod[];

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  CREDIT_CARD: "Credit Card",
  DEBIT_CARD: "Debit Card",
  YAPPY: "Yappy",
  ACH: "ACH",
};

export { PAYMENT_METHOD_LABELS as PAYMENT_METHOD_LABEL };

/** `{ value, label }[]` shape for chip pickers and `<select>` option lists. */
export const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = PAYMENT_METHODS.map((value) => ({
  value,
  label: PAYMENT_METHOD_LABELS[value],
}));
