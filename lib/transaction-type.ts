import type { TransactionType } from "@/app/generated/prisma/client";

export type { TransactionType };

/**
 * The canonical order, values, and copy for the transaction-type
 * picker/filter shared by QuickAddSheet and TransactionFilters — these had
 * already independently converged on the same order/labels, but stayed as
 * two separately hand-typed copies with nothing stopping them drifting
 * apart again (see lib/payment-method.ts for the same pattern).
 */
export const TRANSACTION_TYPES = ["EXPENSE", "INCOME", "SAVINGS"] as const satisfies readonly TransactionType[];

export const TRANSACTION_TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: "EXPENSE", label: "Expense" },
  { value: "INCOME", label: "Extra income" },
  { value: "SAVINGS", label: "Savings" },
];
