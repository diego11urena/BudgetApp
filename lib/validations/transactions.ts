import { z } from "zod";
import { decimalString } from "./shared";

export const transactionTypeSchema = z.enum(["EXPENSE", "INCOME", "SAVINGS"]);

export const paymentMethodSchema = z.enum(["CASH", "CREDIT_CARD", "DEBIT_CARD", "YAPPY"]);

export const addTransactionSchema = z.object({
  type: transactionTypeSchema,
  name: z.string().trim().min(1, "Give it a name").max(100),
  amount: decimalString,
  // Optional: resolves the category separately from the display name, for
  // EXPENSE/SAVINGS edits where they differ (e.g. a Gmail-imported
  // transaction's name is the raw merchant string, not its category).
  // Falls back to `name` when absent, matching manual-entry create — where
  // the two have always been the same value.
  category: z.string().trim().min(1).max(100).optional(),
  // EXPENSE-only, optional — the picker in QuickAddSheet lets the user
  // leave it unset. Empty string (the "not selected" state) is normalized
  // to undefined rather than failing enum validation.
  paymentMethod: z
    .preprocess((v) => (v === "" ? undefined : v), paymentMethodSchema.optional())
    .optional(),
  // "YYYY-MM-DD" from the sheet's Date field — range-checked against the
  // cycle's bounds by the action itself (needs cycle.periodStart, which
  // isn't available to a standalone schema), not here.
  occurredAt: z.string().trim().min(1).optional(),
});

export type AddTransactionInput = z.infer<typeof addTransactionSchema>;
