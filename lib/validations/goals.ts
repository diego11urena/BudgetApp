import { z } from "zod";
import { decimalString } from "./shared";

export const goalSchema = z.object({
  name: z.string().trim().min(1, "Give it a name").max(100),
  lifetimeTargetAmount: decimalString,
  recurringAmount: decimalString.optional(),
  // Only present at creation, and only when the user says they already
  // have money saved toward this goal — sets manualAdjustment directly
  // (an opening balance, not a transaction). Omitted entirely means "no,
  // starting from $0," not "$0 was entered."
  alreadySavedAmount: decimalString.optional(),
});

export const updateGoalSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().trim().min(1, "Give it a name").max(100),
  lifetimeTargetAmount: decimalString,
  recurringAmount: decimalString.optional(),
});

// Same magnitude ceiling decimalString's regex enforces for every other
// money field (Decimal(12,2) -- 10 integer digits, 2 decimal). delta is a
// signed number, not a decimalString, so it needs its own explicit bound:
// .finite() alone rejects NaN/Infinity but not something like 1e15, which
// would silently overflow the column.
const MAX_DECIMAL_12_2 = 9_999_999_999.99;

/**
 * A contribution delta -- signed, positive when increasing the tracked
 * total, negative when decreasing it. Used by updateGoalWithContributionAction
 * (goals/actions.ts), which treats exactly 0 as "the saved-so-far field
 * wasn't touched," so 0 is a valid value here (unlike a real contribution,
 * which the action itself rejects as a no-op before it ever reaches this).
 */
export const goalContributionDeltaSchema = z
  .number()
  .finite()
  .refine((n) => Math.abs(n) <= MAX_DECIMAL_12_2, "Amount is too large");
