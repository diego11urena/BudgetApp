import { z } from "zod";

// Shared with every client-side amount check (QuickAddSheet, EditPayInfoSheet,
// EditGoalSheet) so the message never drifts between what the browser
// catches and what the server would have said anyway.
export const INVALID_AMOUNT_FORMAT_MESSAGE = "Enter a valid amount (e.g. 1234.56)";
export const AMOUNT_NOT_POSITIVE_MESSAGE = "Amount must be greater than $0";

// Up to 10 integer digits (so it can never overflow a Decimal(12,2) column)
// plus up to 2 decimal places -- no sign, so nothing matching this can ever
// be negative. The single source both decimalString (server) and
// validateAmountFormat (client) check against.
const AMOUNT_FORMAT_REGEX = /^\d{1,10}(\.\d{1,2})?$/;

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
  .regex(AMOUNT_FORMAT_REGEX, INVALID_AMOUNT_FORMAT_MESSAGE)
  .refine((value) => Number(value) > 0, AMOUNT_NOT_POSITIVE_MESSAGE);

/**
 * The client-side half of decimalString's format rule, for instant inline
 * feedback without a round trip -- the server still independently
 * re-validates via decimalString regardless, this never replaces that.
 * Previously each of QuickAddSheet/EditPayInfoSheet/EditGoalSheet hand-
 * rolled its own looser `Number.isNaN(Number(value))` check here, which
 * (unlike this regex) accepts things decimalString would reject server-side
 * -- "1e5", ".5", "1.999", a leading "+". Deliberately doesn't check
 * positivity: that's a separate, caller-supplied concern, since not every
 * amount field requires a strictly-positive value (goals' "already saved"
 * can legitimately be exactly $0 -- and this regex, having no sign, already
 * guarantees non-negative on its own).
 */
export function validateAmountFormat(value: string): string | null {
  return AMOUNT_FORMAT_REGEX.test(value.trim()) ? null : INVALID_AMOUNT_FORMAT_MESSAGE;
}

/** A category/goal/income-source name — shared so length/emptiness rules stay in sync everywhere one is entered. */
export const categoryNameSchema = z.string().trim().min(1, "Give it a name").max(100);
