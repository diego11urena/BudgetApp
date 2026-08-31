"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import { upsertGoalAction } from "@/app/(app)/goals/actions";
import type { ActionResult } from "@/lib/action-error";

export type GoalStepFormState = ActionResult | undefined;

/**
 * Onboarding's 3rd and final step. A goal name provided here goes through
 * the real upsertGoalAction goal-creation path -- the same one AddGoalSheet
 * uses -- so the goal is immediately visible/editable on Plan afterward.
 * This is the whole point of routing through it rather than writing
 * directly: a previous "Savings" onboarding step (see getOnboardingState's
 * own comment) wrote a lifetime target nothing downstream ever read, with
 * no way to reach or edit it after, and was removed for being write-only.
 *
 * Marks the step done via the cycle's existing (and until now unused)
 * savingsConfirmedAt column -- see getOnboardingState's comment for why
 * this reuses that column instead of a new migration.
 */
export async function saveGoalStepAction(
  _prevState: GoalStepFormState,
  formData: FormData,
): Promise<GoalStepFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const name = String(formData.get("name") ?? "").trim();
  if (name) {
    const result = await upsertGoalAction(undefined, formData);
    if (result && "error" in result) {
      return result;
    }
  }

  await finishGoalStep(userId);
  redirect("/onboarding-complete");
}

export async function skipGoalStepAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  await finishGoalStep(session.user.id);
  redirect("/onboarding-complete");
}

async function finishGoalStep(userId: string): Promise<void> {
  const cycle = await getOrCreateDraftCycle(userId);
  await prisma.$transaction([
    prisma.budgetCycle.update({ where: { id: cycle.id }, data: { savingsConfirmedAt: new Date() } }),
    prisma.user.update({ where: { id: userId }, data: { onboardingCompletedAt: new Date() } }),
  ]);
}
