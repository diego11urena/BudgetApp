import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import type { BudgetCycle } from "@/app/generated/prisma/client";

export type OnboardingStep = "income" | "expenses" | "goal";

export const ONBOARDING_STEP_ORDER: OnboardingStep[] = ["income", "expenses", "goal"];

export interface OnboardingState {
  cycle: BudgetCycle;
  hasIncome: boolean;
  hasExpenses: boolean;
  hasGoalStep: boolean;
  /** The first step not yet done, or null if all three are done. */
  nextStep: OnboardingStep | null;
}

/**
 * Resolves onboarding progress. Income still requires at least one row, so
 * row presence is a valid completion signal for it. Expenses and the goal
 * step both allow a blank/skipped answer, so each is tracked via its own
 * explicit "step submitted" timestamp on the cycle instead — otherwise
 * "nothing entered" would be indistinguishable from "not visited yet".
 *
 * The goal step reuses the cycle's existing `savingsConfirmedAt` column --
 * a 3rd "Savings" onboarding step lived here once before (see git history:
 * it asked for a lifetime target that nothing downstream ever read, a
 * write-only screen with no way to reach it, removed in batch 11.6), and
 * its own completion column was never cleaned up. The NEW goal step
 * avoids repeating that mistake by routing through the real
 * upsertGoalAction goal-creation path (same one AddGoalSheet uses), so a
 * goal created here is immediately visible/editable on Plan afterward.
 */
export async function getOnboardingState(userId: string): Promise<OnboardingState> {
  const cycle = await getOrCreateDraftCycle(userId);

  const incomeCount = await prisma.cycleIncomeEntry.count({ where: { cycleId: cycle.id } });

  const hasIncome = incomeCount > 0;
  const hasExpenses = cycle.expensesConfirmedAt !== null;
  const hasGoalStep = cycle.savingsConfirmedAt !== null;

  let nextStep: OnboardingStep | null = null;
  if (!hasIncome) nextStep = "income";
  else if (!hasExpenses) nextStep = "expenses";
  else if (!hasGoalStep) nextStep = "goal";

  return { cycle, hasIncome, hasExpenses, hasGoalStep, nextStep };
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
