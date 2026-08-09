"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import { hashPassword, verifyPassword } from "@/lib/password";
import { checkRateLimit } from "@/lib/rate-limit";
import { changePasswordSchema, incomeStepSchema } from "@/lib/validations/onboarding";

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}

export type ChangePasswordFormState = { error?: string; success?: boolean } | undefined;

const CHANGE_PASSWORD_RATE_LIMIT = { max: 5, windowMs: 60_000 };

export async function changePasswordAction(
  _prevState: ChangePasswordFormState,
  formData: FormData,
): Promise<ChangePasswordFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const rateLimit = checkRateLimit(`changepw:${userId}`, CHANGE_PASSWORD_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return { error: `Too many attempts. Try again in ${rateLimit.retryAfterSeconds}s.` };
  }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { hashedPassword: true },
  });
  if (!user) {
    return { error: "Account not found" };
  }

  const isValid = await verifyPassword(currentPassword, user.hashedPassword);
  if (!isValid) {
    return { error: "Current password is incorrect" };
  }

  const hashedPassword = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { hashedPassword } });

  return { success: true };
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
