import { z } from "zod";
import { categoryNameSchema, decimalString } from "./shared";

/** Name/amount/category/frequency for one recurring expense -- the single create-then-edit sheet shape (see recurring-actions.ts), replacing the old separate create-target-then-set-frequency-later flow. */
export const recurringExpenseSchema = z
  .object({
    name: z.string().trim().min(1, "Give it a name").max(100),
    amount: decimalString,
    categoryName: categoryNameSchema,
    frequency: z.enum(["BIWEEKLY", "MONTHLY"]).default("BIWEEKLY"),
    dueDay: z.coerce.number().int().min(1).max(31).optional(),
    /**
     * Defaults true (create's own prior behavior, relying on the DB
     * default) -- false marks a one-time bill that won't carry into the
     * next quincena. See RecurringExpenseEditSheet's single
     * recurrence-choice control. z.coerce.boolean() is deliberately NOT
     * used here -- it coerces via JS's own Boolean(value), under which
     * the string "false" is truthy and would silently become `true`.
     */
    recurring: z
      .union([z.literal("true"), z.literal("false")])
      .optional()
      .transform((v) => v !== "false"),
  })
  .refine((data) => data.frequency !== "MONTHLY" || data.dueDay !== undefined, {
    message: "Pick a due day for a monthly expense",
    path: ["dueDay"],
  });
