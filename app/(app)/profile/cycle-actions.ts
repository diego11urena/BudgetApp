"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import { revalidateAppPages } from "@/lib/revalidate";

/**
 * Deletes every cycle for the user — cascades every transaction, budget
 * target, and income entry within them — then immediately creates a fresh
 * cycle with the current income baseline applied, so the dashboard is
 * usable right away instead of showing a broken $0 state. Categories, the
 * income source itself, and onboarding status are untouched: this wipes
 * history, not account setup.
 */
export async function eraseAllCyclesAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  await prisma.budgetCycle.deleteMany({ where: { userId } });

  const cycle = await getOrCreateDraftCycle(userId);
  const incomeSource = await prisma.incomeSource.findFirst({
    where: { userId, isActive: true },
    orderBy: { createdAt: "asc" },
  });
  if (incomeSource) {
    await prisma.cycleIncomeEntry.create({
      data: { cycleId: cycle.id, incomeSourceId: incomeSource.id, netAmount: incomeSource.netQuincenaAmount },
    });
  }

  revalidateAppPages();
}
