import { z } from "zod";

/**
 * A positive USD amount with up to 2 decimal places, e.g. "1234.56".
 * Bounded to at most 10 integer digits so it can never overflow a
 * Decimal(12,2) column (12 total digits, 2 of them after the point) with a
 * raw, unhandled database error — this is the shared validator for every
 * money field in the app (transactions, budget/goal targets, income), so
 * fixing it here fixes all of them at once.
 */
export const decimalString = z
  .string()
  .trim()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, "Enter a valid amount (e.g. 1234.56)")
  .refine((value) => Number(value) > 0, "Amount must be greater than $0");

/** A category/goal/income-source name — shared so length/emptiness rules stay in sync everywhere one is entered. */
export const categoryNameSchema = z.string().trim().min(1, "Give it a name").max(100);
