"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import { withActionErrorHandling } from "@/lib/action-error";

/**
 * Dev-only testing helper. getOrCreateDraftCycle returns whichever cycle is
 * currently DRAFT *or* ACTIVE — for an already-onboarded user that's their
 * real, in-use cycle, not just an empty draft — and this deletes it whole
 * (transactions, income entries, and budget/goal targets all cascade with
 * it), then reopens onboarding. Never active outside development, regardless
 * of how it's invoked. The confirm() gate lives client-side in
 * DevResetButton, since this can destroy real logged data, not just an
 * abandoned in-progress signup.
 */
export const resetOnboardingAction = withActionErrorHandling(async function resetOnboardingAction() {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const cycle = await getOrCreateDraftCycle(userId);

  await prisma.$transaction([
    prisma.budgetCycle.delete({ where: { id: cycle.id } }),
    prisma.user.update({ where: { id: userId }, data: { onboardingCompletedAt: null } }),
  ]);

  redirect("/onboarding");
});
