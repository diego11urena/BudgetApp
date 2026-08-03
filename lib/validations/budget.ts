import { z } from "zod";
import { decimalString } from "./shared";

export const budgetGoalSchema = z.object({
  name: z.string().trim().min(1, "Give it a name").max(100),
  targetAmount: decimalString,
});

/** dueDay is only required (and only meaningful) when frequency is MONTHLY. */
export const recurringFrequencySchema = z
  .object({
    frequency: z.enum(["BIWEEKLY", "MONTHLY"]),
    dueDay: z.coerce.number().int().min(1).max(31).optional(),
  })
  .refine((data) => data.frequency !== "MONTHLY" || data.dueDay !== undefined, {
    message: "Pick a due day for a monthly expense",
    path: ["dueDay"],
  });
