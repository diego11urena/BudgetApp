"use server";

import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { checkRateLimit } from "@/lib/rate-limit";
import { changePasswordSchema } from "@/lib/validations/onboarding";
import { withActionErrorHandling, type ActionResult } from "@/lib/action-error";

export const signOutAction = withActionErrorHandling(async function signOutAction() {
  await signOut({ redirectTo: "/login" });
});

export type ChangePasswordFormState = ActionResult<{ success: true }> | undefined;

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

  const rateLimit = await checkRateLimit(`changepw:${userId}`, CHANGE_PASSWORD_RATE_LIMIT, {
    failClosed: true,
  });
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
  // Incrementing sessionVersion here (not just the password hash) is what
  // actually revokes every other device's session -- see lib/auth.ts's
  // session() callback, which compares this against what's baked into
  // each existing JWT and treats a mismatch as logged out.
  await prisma.user.update({
    where: { id: userId },
    data: { hashedPassword, sessionVersion: { increment: 1 } },
  });

  return { success: true };
});

export const logOutEverywhereAction = withActionErrorHandling(async function logOutEverywhereAction() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  await prisma.user.update({
    where: { id: session.user.id },
    data: { sessionVersion: { increment: 1 } },
  });
  // Also signs this device out (its own session's baked-in version now
  // fails the same check every other device's does on its next request)
  // -- clicking "log out everywhere" ending the very session you clicked
  // it from is the expected behavior, not an oversight.
  await signOut({ redirectTo: "/login" });
});
