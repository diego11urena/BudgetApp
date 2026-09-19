import { z } from "zod";
import { categoryNameSchema, decimalString } from "./shared";

/** Name/amount/category/schedule for one recurring expense -- the single create-then-edit sheet shape (see recurring-actions.ts), replacing the old separate create-target-then-set-schedule-later flow. */
export const recurringExpenseSchema = z
  .object({
    name: z.string().trim().min(1, "Give it a name").max(100),
    amount: decimalString,
    categoryName: categoryNameSchema,
    /**
     * Scheduled (true, a real due date -- Spotify, iCloud) vs Ongoing
     * (false, the default -- recurs but no set date, e.g. Panapass, a
     * haircut). z.coerce.boolean() is deliberately NOT used here -- it
     * coerces via JS's own Boolean(value), under which the string "false"
     * is truthy and would silently become `true`. See
     * RecurringExpenseEditSheet's "Does this have a set date?" toggle.
     */
    hasFixedDate: z
      .union([z.literal("true"), z.literal("false")])
      .optional()
      .transform((v) => v === "true"),
    dueDay: z.coerce.number().int().min(1).max(31).optional(),
    /**
     * Defaults true (create's own prior behavior, relying on the DB
     * default) -- false marks a one-time expense that won't carry into
     * the next quincena. See RecurringExpenseEditSheet's own "Repeats /
     * One-time" control -- independent of hasFixedDate above. Same
     * deliberate-non-coercion reasoning as hasFixedDate.
     */
    recurring: z
      .union([z.literal("true"), z.literal("false")])
      .optional()
      .transform((v) => v !== "false"),
  })
  .refine((data) => !data.hasFixedDate || data.dueDay !== undefined, {
    message: "Pick a due day for a scheduled expense",
    path: ["dueDay"],
  });
