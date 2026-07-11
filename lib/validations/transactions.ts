import { z } from "zod";
import { decimalString } from "./shared";

export const transactionTypeSchema = z.enum(["EXPENSE", "INCOME", "SAVINGS"]);

export const addTransactionSchema = z.object({
  type: transactionTypeSchema,
  name: z.string().trim().min(1, "Give it a name").max(100),
  amount: decimalString,
});

export type AddTransactionInput = z.infer<typeof addTransactionSchema>;
