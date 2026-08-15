import { z } from "zod";

// Shared with every client-side amount check (QuickAddSheet, EditPayInfoSheet)
// so the message never drifts between what the browser catches and what the
// server would have said anyway.
export const INVALID_AMOUNT_FORMAT_MESSAGE = "Enter a valid amount (e.g. 1234.56)";
export const AMOUNT_NOT_POSITIVE_MESSAGE = "Amount must be greater than $0";

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
  .regex(/^\d{1,10}(\.\d{1,2})?$/, INVALID_AMOUNT_FORMAT_MESSAGE)
  .refine((value) => Number(value) > 0, AMOUNT_NOT_POSITIVE_MESSAGE);

/** A category/goal/income-source name — shared so length/emptiness rules stay in sync everywhere one is entered. */
export const categoryNameSchema = z.string().trim().min(1, "Give it a name").max(100);
