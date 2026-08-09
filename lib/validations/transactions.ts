import { z } from "zod";
import { decimalString } from "./shared";

export const transactionTypeSchema = z.enum(["EXPENSE", "INCOME", "SAVINGS"]);

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
});

export type AddTransactionInput = z.infer<typeof addTransactionSchema>;
