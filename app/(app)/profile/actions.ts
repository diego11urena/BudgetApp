"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { signOut } from "@/lib/auth";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { checkRateLimit } from "@/lib/rate-limit";
import { changePasswordSchema } from "@/lib/validations/onboarding";
import { withActionErrorHandling, type ActionResult } from "@/lib/action-error";
import { THEME_COOKIE, THEME_VALUES, type ThemePreferenceValue } from "@/lib/theme";
import { LOCALE_COOKIE, isLocaleValue, getRequestLocale } from "@/lib/i18n/locale";
import type { BudgetFrequency } from "@/lib/quincena-pace";
import type { IncomeFrequency } from "@/app/generated/prisma/client";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { translateValidationMessage } from "@/lib/i18n/translate-validation-message";

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
  const t = getDictionary(await getRequestLocale());

  const rateLimit = await checkRateLimit(`changepw:${userId}`, CHANGE_PASSWORD_RATE_LIMIT, {
    failClosed: true,
  });
  if (!rateLimit.allowed) {
    return { error: t.common.tooManyAttempts(rateLimit.retryAfterSeconds) };
  }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) {
    return { error: translateValidationMessage(parsed.error.issues[0]?.message ?? "", t) || t.common.invalidInput };
  }
  const { currentPassword, newPassword } = parsed.data;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { hashedPassword: true },
  });
  if (!user) {
    return { error: t.profile.changePassword.accountNotFound };
  }

  const isValid = await verifyPassword(currentPassword, user.hashedPassword);
  if (!isValid) {
    return { error: t.profile.changePassword.currentPasswordIncorrect };
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

/**
 * DB is the source of truth (so the preference follows the user across
 * devices); the cookie is a read-side cache the root layout uses to
 * render the right [data-theme] attribute server-side without a DB
 * round trip on every single request. Kept in sync on every write here.
 */
export const setThemeAction = withActionErrorHandling(async function setThemeAction(
  formData: FormData,
): Promise<ActionResult | undefined> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const raw = formData.get("theme");
  if (typeof raw !== "string" || !THEME_VALUES.includes(raw as ThemePreferenceValue)) {
    return { error: "Invalid theme" };
  }
  const theme = raw as ThemePreferenceValue;

  await prisma.user.update({
    where: { id: session.user.id },
    data: { theme: theme.toUpperCase() as "SYSTEM" | "LIGHT" | "DARK" },
  });

  const cookieStore = await cookies();
  cookieStore.set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
});

/**
 * Same DB-is-source-of-truth / cookie-is-read-cache split as
 * setThemeAction above. Unlike theme there's no "system" option to defer
 * to -- just an explicit en/es choice.
 */
export const setLocaleAction = withActionErrorHandling(async function setLocaleAction(
  formData: FormData,
): Promise<ActionResult | undefined> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const raw = formData.get("locale");
  if (!isLocaleValue(raw)) {
    return { error: "Invalid language" };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { locale: raw.toUpperCase() as "EN" | "ES" },
  });

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, raw, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
});

const BUDGET_FREQUENCY_VALUES: BudgetFrequency[] = ["QUINCENAL", "MONTHLY"];

/**
 * No cookie, unlike setThemeAction/setLocaleAction above -- budgetFrequency
 * only ever matters once a request is already authenticated (pace/carry-
 * forward math, the copy sweep's period vocab), never on an anonymous
 * pre-auth request the way theme/locale are read on every page load, so a
 * straight per-request DB read (see lib/cycles.ts's getUserBudgetFrequency) is
 * simpler and sufficient -- no read-side cache needed at the page level.
 *
 * The root layout's own read is a different story: it feeds
 * LocaleProvider's client context (useBudgetFrequency/useVocab), and
 * without an explicit layout revalidation here, Next.js's client Router
 * Cache can keep serving the already-rendered root layout (with the OLD
 * budgetFrequency baked into that context) across subsequent
 * navigations, even though every individual PAGE does its own fresh DB
 * read and renders correctly. theme/locale don't need this because
 * mutating their cookie already triggers Next's own automatic
 * invalidation -- budgetFrequency deliberately has no cookie, so it needs
 * this explicit revalidatePath("/", "layout") instead.
 */
export const setBudgetFrequencyAction = withActionErrorHandling(async function setBudgetFrequencyAction(
  formData: FormData,
): Promise<ActionResult | undefined> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const raw = formData.get("budgetFrequency");
  if (typeof raw !== "string" || !BUDGET_FREQUENCY_VALUES.includes(raw as BudgetFrequency)) {
    return { error: "Invalid budget frequency" };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { budgetFrequency: raw as BudgetFrequency },
  });

  revalidatePath("/", "layout");
});

const PAY_FREQUENCY_VALUES: IncomeFrequency[] = ["MONTHLY", "SEMIMONTHLY", "BIWEEKLY"];

/**
 * Same no-cookie reasoning as setBudgetFrequencyAction -- purely
 * descriptive (see User.payFrequency's own schema comment), never read
 * pre-auth.
 */
export const setIncomeFrequencyAction = withActionErrorHandling(async function setIncomeFrequencyAction(
  formData: FormData,
): Promise<ActionResult | undefined> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const raw = formData.get("payFrequency");
  if (typeof raw !== "string" || !PAY_FREQUENCY_VALUES.includes(raw as IncomeFrequency)) {
    return { error: "Invalid pay frequency" };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { payFrequency: raw as IncomeFrequency },
  });
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
