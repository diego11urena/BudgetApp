"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveIncomeSource, getOrCreateDraftCycle, upsertCycleIncomeEntry } from "@/lib/cycles";
import { hashPassword, verifyPassword } from "@/lib/password";
import { checkRateLimit } from "@/lib/rate-limit";
import { changePasswordSchema, incomeStepSchema } from "@/lib/validations/onboarding";
import { withActionErrorHandling } from "@/lib/action-error";

export const signOutAction = withActionErrorHandling(async function signOutAction() {
  await signOut({ redirectTo: "/login" });
});

export type ChangePasswordFormState = { error?: string; success?: boolean } | undefined;

const CHANGE_PASSWORD_RATE_LIMIT = { max: 5, windowMs: 60_000 };

export const changePasswordAction = withActionErrorHandling(async function changePasswordAction(
  _prevState: ChangePasswordFormState,
  formData: FormData,
): Promise<ChangePasswordFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const rateLimit = await checkRateLimit(`changepw:${userId}`, CHANGE_PASSWORD_RATE_LIMIT);
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
});

export type IncomeSettingsFormState = { error?: string; success?: boolean } | undefined;

export const updateIncomeAction = withActionErrorHandling(async function updateIncomeAction(
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

  const incomeSource = await getActiveIncomeSource(prisma, userId);
  if (!incomeSource) {
    return { error: "No income source found yet — complete onboarding first." };
  }

  // Updates the current open cycle's income entry in place — creating one
  // if it's somehow missing, rather than silently doing nothing. Past
  // closed cycles are frozen history and are never rewritten. Both writes
  // share one $transaction so a mid-way failure can't leave Profile
  // showing the new amount while Home's own cycle entry still has the old
  // one (they were previously two separate awaits).
  const cycle = await getOrCreateDraftCycle(userId);
  await prisma.$transaction([
    prisma.incomeSource.update({
      where: { id: incomeSource.id },
      data: { name, netQuincenaAmount },
    }),
    upsertCycleIncomeEntry(prisma, cycle.id, incomeSource.id, netQuincenaAmount),
  ]);

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  revalidatePath("/budget");
  revalidatePath("/goals");
  revalidatePath("/transactions");

  return { success: true };
});
