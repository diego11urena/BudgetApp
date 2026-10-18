import { z } from "zod";
import { categoryNameSchema, decimalString } from "./shared";

/** Name/amount/category/schedule for one recurring expense -- the single create-then-edit sheet shape (see recurring-actions.ts), replacing the old separate create-target-then-set-schedule-later flow. */
export const recurringExpenseSchema = z.object({
  name: z.string().trim().min(1, "Give it a name").max(100),
  amount: decimalString,
  categoryName: categoryNameSchema,
  /** Day of the month it's charged. Optional: blank means no set date. */
  dueDay: z.coerce.number().int().min(1).max(31).optional(),
  /**
   * Defaults true (create's own prior behavior, relying on the DB
   * default) -- false marks a one-time expense that won't carry into
   * the next quincena. See RecurringExpenseEditSheet's own "Repeats /
   * One-time" control -- independent of dueDay above. z.coerce.boolean()
   * is deliberately not used: it would turn the string "false" into true.
   */
  recurring: z
    .union([z.literal("true"), z.literal("false")])
    .optional()
    .transform((v) => v !== "false"),
});
