import { z } from "zod";
import { decimalString } from "./shared";

export const incomeStepSchema = z
  .object({
    netPayAmount: decimalString,
    budgetFrequency: z.enum(["QUINCENAL", "MONTHLY"]).default("QUINCENAL"),
    // Purely descriptive (how often income arrives) -- distinct from
    // budgetFrequency above, which controls actual cycle-length math.
    // Default matches what every account implicitly was before this field
    // existed (quincena = paid twice a month). BIWEEKLY was removed as a
    // distinct option -- collapsed into SEMIMONTHLY, see IncomeFrequency's
    // own schema comment.
    payFrequency: z.enum(["MONTHLY", "SEMIMONTHLY"]).default("SEMIMONTHLY"),
  })
  // A once-a-month earner has no second paycheck to split a quincena
  // around -- MONTHLY pay + QUINCENAL budget is not a supported
  // combination. The picker itself already prevents selecting it (see
  // IncomeForm.tsx), but this is the server-side backstop: a raw POST
  // that skips the client entirely must not be able to write this
  // invalid state either.
  .refine((data) => !(data.payFrequency === "MONTHLY" && data.budgetFrequency === "QUINCENAL"), {
    message: "Monthly pay frequency requires monthly budget frequency",
    path: ["budgetFrequency"],
  });

export const budgetLineItemSchema = z.object({
  name: z.string().trim().min(1).max(100),
  targetAmount: decimalString,
  /** Scheduled (true, a real due date -- Spotify, iCloud) vs Ongoing (false, the default -- recurs but no set date, e.g. Panapass, a haircut). See RecurringExpense's own schema comment. A genuine boolean, not the FormData string-literal pattern other schemas here use -- this arrives via itemsJson's own JSON.parse, which already restores real booleans. */
  hasFixedDate: z.boolean().optional(),
  // Only meaningful when hasFixedDate is true -- see RecurringExpense.dueDay's own schema comment.
  dueDay: z.coerce.number().int().min(1).max(31).optional(),
});

export const budgetLineItemsSchema = z.object({
  // saveExpensesAction iterates this inside one
  // interactive $transaction with 2-3 writes per item -- an unbounded
  // array turns a large-but-plausible client payload into a long-running
  // transaction against the DB. 50 is generously above any real onboarding
  // list (a handful of fixed expenses/goals) while still bounding the
  // worst case.
  items: z.array(budgetLineItemSchema).max(50),
});

export type IncomeStepInput = z.infer<typeof incomeStepSchema>;
export type BudgetLineItemsInput = z.infer<typeof budgetLineItemsSchema>;
