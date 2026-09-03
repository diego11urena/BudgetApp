import { z } from "zod";
import { decimalString } from "./shared";

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  // bcryptjs silently truncates at 72 bytes -- an explicit max means a
  // very long password fails loudly here instead of the part past byte
  // 72 quietly never mattering to the hash.
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .max(72, "New password must be at most 72 characters"),
});

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
  // Only meaningful for a MONTHLY recurring expense (see
  // RecurringExpense.dueDay's own schema comment) -- onboarding's bills
  // step collects it as plain display metadata regardless of frequency,
  // same as every other dueDay call site already treats it.
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

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type IncomeStepInput = z.infer<typeof incomeStepSchema>;
export type BudgetLineItemsInput = z.infer<typeof budgetLineItemsSchema>;
