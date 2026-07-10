import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import type { BudgetCycle } from "@/app/generated/prisma/client";

export type OnboardingStep = "income" | "expenses" | "accounts";

export const ONBOARDING_STEP_ORDER: OnboardingStep[] = ["income", "expenses", "accounts"];

export interface OnboardingState {
  cycle: BudgetCycle;
  hasIncome: boolean;
  hasExpenses: boolean;
  hasAccounts: boolean;
  /** The first step with no data yet, or null if all three have data. */
  nextStep: OnboardingStep | null;
}

/** Resolves onboarding progress purely from which cycle rows already exist. */
export async function getOnboardingState(userId: string): Promise<OnboardingState> {
  const cycle = await getOrCreateDraftCycle(userId);

  const [incomeCount, goalCount, balanceCount] = await Promise.all([
    prisma.cycleIncomeEntry.count({ where: { cycleId: cycle.id } }),
    prisma.cycleBudgetGoal.count({ where: { cycleId: cycle.id } }),
    prisma.cycleAccountBalance.count({ where: { cycleId: cycle.id } }),
  ]);

  const hasIncome = incomeCount > 0;
  const hasExpenses = goalCount > 0;
  const hasAccounts = balanceCount > 0;

  let nextStep: OnboardingStep | null = null;
  if (!hasIncome) nextStep = "income";
  else if (!hasExpenses) nextStep = "expenses";
  else if (!hasAccounts) nextStep = "accounts";

  return { cycle, hasIncome, hasExpenses, hasAccounts, nextStep };
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
