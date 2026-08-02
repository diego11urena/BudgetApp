"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftCycle } from "@/lib/cycles";

/**
 * Dev-only testing helper: wipes the current cycle (income/expenses/savings
 * cascade-delete with it) and reopens onboarding. Never active outside
 * development, regardless of how it's invoked.
 */
export async function resetOnboardingAction() {
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
}
