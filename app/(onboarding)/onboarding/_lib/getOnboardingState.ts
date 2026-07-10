import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import type { BudgetCycle } from "@/app/generated/prisma/client";

export type OnboardingStep = "income" | "expenses" | "savings";

export const ONBOARDING_STEP_ORDER: OnboardingStep[] = ["income", "expenses", "savings"];

export interface OnboardingState {
  cycle: BudgetCycle;
  hasIncome: boolean;
  hasExpenses: boolean;
  hasSavings: boolean;
  /** The first step not yet done, or null if all three are done. */
  nextStep: OnboardingStep | null;
}

/**
 * Resolves onboarding progress. Income still requires at least one row, so
 * row presence is a valid completion signal for it. Expenses and Savings
 * allow zero rows, so they're tracked via explicit
 * `expensesConfirmedAt`/`savingsConfirmedAt` timestamps on the cycle instead
 * — otherwise "zero rows" would be indistinguishable from "not visited yet".
 */
export async function getOnboardingState(userId: string): Promise<OnboardingState> {
  const cycle = await getOrCreateDraftCycle(userId);

  const incomeCount = await prisma.cycleIncomeEntry.count({ where: { cycleId: cycle.id } });

  const hasIncome = incomeCount > 0;
  const hasExpenses = cycle.expensesConfirmedAt !== null;
  const hasSavings = cycle.savingsConfirmedAt !== null;

  let nextStep: OnboardingStep | null = null;
  if (!hasIncome) nextStep = "income";
  else if (!hasExpenses) nextStep = "expenses";
  else if (!hasSavings) nextStep = "savings";

  return { cycle, hasIncome, hasExpenses, hasSavings, nextStep };
}

/**
 * Guards a specific onboarding step page: redirects to /dashboard if
 * onboarding data is already complete, or back to the earliest incomplete
 * step if the user tries to jump ahead.
 */
export async function requireOnboardingStep(
  userId: string,
  step: OnboardingStep,
): Promise<OnboardingState> {
  const state = await getOnboardingState(userId);

  if (state.nextStep === null) {
    redirect("/dashboard");
  }

  const requiredIndex = ONBOARDING_STEP_ORDER.indexOf(step);
  const currentIndex = ONBOARDING_STEP_ORDER.indexOf(state.nextStep);

  if (requiredIndex > currentIndex) {
    redirect(`/onboarding/${state.nextStep}`);
  }

  return state;
}
