import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import type { BudgetCycle } from "@/app/generated/prisma/client";

export type OnboardingStep = "income" | "expenses";

export const ONBOARDING_STEP_ORDER: OnboardingStep[] = ["income", "expenses"];

export interface OnboardingState {
  cycle: BudgetCycle;
  hasIncome: boolean;
  hasExpenses: boolean;
  /** The first step not yet done, or null if both are done. */
  nextStep: OnboardingStep | null;
}

/**
 * Resolves onboarding progress. Income still requires at least one row, so
 * row presence is a valid completion signal for it. Expenses allows zero
 * rows, so it's tracked via an explicit `expensesConfirmedAt` timestamp on
 * the cycle instead — otherwise "zero rows" would be indistinguishable from
 * "not visited yet". (A third step, Savings, used to live here too — it
 * asked for a lifetime target that nothing downstream ever read, a
 * write-only screen with no way to reach it. Removed rather than fixed:
 * AddGoalSheet on /goals is a strictly better place to capture that intent,
 * once there's an actual surplus to put toward it.)
 */
export async function getOnboardingState(userId: string): Promise<OnboardingState> {
  const cycle = await getOrCreateDraftCycle(userId);

  const incomeCount = await prisma.cycleIncomeEntry.count({ where: { cycleId: cycle.id } });

  const hasIncome = incomeCount > 0;
  const hasExpenses = cycle.expensesConfirmedAt !== null;

  let nextStep: OnboardingStep | null = null;
  if (!hasIncome) nextStep = "income";
  else if (!hasExpenses) nextStep = "expenses";

  return { cycle, hasIncome, hasExpenses, nextStep };
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
