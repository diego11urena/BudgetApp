"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import { incomeStepSchema } from "@/lib/validations/onboarding";

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

export type IncomeSettingsFormState = { error?: string; success?: boolean } | undefined;

export async function updateIncomeAction(
  _prevState: IncomeSettingsFormState,
  formData: FormData,
): Promise<IncomeSettingsFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const parsed = incomeStepSchema.safeParse({
    name: formData.get("name"),
    netQuincenaAmount: formData.get("netQuincenaAmount"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { name, netQuincenaAmount } = parsed.data;

  const incomeSource = await prisma.incomeSource.findFirst({
    where: { userId, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  if (!incomeSource) {
    return { error: "No income source found yet — complete onboarding first." };
  }

  await prisma.incomeSource.update({
    where: { id: incomeSource.id },
    data: { name, netQuincenaAmount },
  });

  // Update the current open cycle's income entry in place, if one exists.
  // Past closed cycles are frozen history and are never rewritten.
  const cycle = await getOrCreateDraftCycle(userId);
  const existingEntry = await prisma.cycleIncomeEntry.findFirst({
    where: { cycleId: cycle.id, incomeSourceId: incomeSource.id },
  });

  if (existingEntry) {
    await prisma.cycleIncomeEntry.update({
      where: { id: existingEntry.id },
      data: { netAmount: netQuincenaAmount },
    });
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  revalidatePath("/budget");
  revalidatePath("/goals");
  revalidatePath("/transactions");

  return { success: true };
}
