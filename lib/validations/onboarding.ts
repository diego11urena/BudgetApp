import { z } from "zod";
import { decimalString } from "./shared";

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const incomeStepSchema = z.object({
  name: z.string().trim().min(1, "Give this income a name").max(100),
  netQuincenaAmount: decimalString,
});

export const budgetLineItemSchema = z.object({
  name: z.string().trim().min(1).max(100),
  targetAmount: decimalString,
});

export const budgetLineItemsSchema = z.object({
  items: z.array(budgetLineItemSchema),
});

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type IncomeStepInput = z.infer<typeof incomeStepSchema>;
export type BudgetLineItemsInput = z.infer<typeof budgetLineItemsSchema>;
