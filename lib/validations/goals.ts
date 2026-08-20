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

/** delta is signed: positive when increasing the tracked total, negative when decreasing it. Zero is rejected by the action itself (a no-op edit shouldn't reach this at all). */
export const adjustGoalContributionSchema = z.object({
  categoryId: z.string().min(1),
  delta: z.number().finite().refine((n) => n !== 0, "No change to record"),
});
