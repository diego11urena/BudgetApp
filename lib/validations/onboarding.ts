import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

const decimalString = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,2})?$/, "Enter a valid amount (e.g. 1234.56)");

export const incomeStepSchema = z.object({
  name: z.string().trim().min(1, "Give this income a name").max(100),
  grossMonthlyAmount: decimalString,
  isPanamaPayroll: z.boolean(),
});

export const budgetLineItemSchema = z.object({
  name: z.string().trim().min(1).max(100),
  targetAmount: decimalString,
});

export const budgetLineItemsSchema = z.object({
  items: z.array(budgetLineItemSchema),
});

export const financialAccountTypeSchema = z.enum([
  "CHECKING",
  "SAVINGS",
  "CASH",
  "CREDIT_CARD",
  "LOAN",
  "OTHER_DEBT",
]);

export const accountInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: financialAccountTypeSchema,
  amount: decimalString,
});

export const accountsStepSchema = z.object({
  accounts: z.array(accountInputSchema).min(1, "Add at least one account"),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type IncomeStepInput = z.infer<typeof incomeStepSchema>;
export type BudgetLineItemsInput = z.infer<typeof budgetLineItemsSchema>;
export type AccountsStepInput = z.infer<typeof accountsStepSchema>;
