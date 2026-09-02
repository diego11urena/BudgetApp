"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { signIn } from "@/lib/auth";
import { signupSchema } from "@/lib/validations/onboarding";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { seedDefaultIncomeCategories } from "@/lib/categories";
import { isUniqueConstraintViolation } from "@/lib/prisma-errors";
import type { ActionResult } from "@/lib/action-error";
import { LOCALE_COOKIE, getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { translateValidationMessage } from "@/lib/i18n/translate-validation-message";

export type SignupFormState = ActionResult | undefined;

const SIGNUP_RATE_LIMIT = { max: 5, windowMs: 60_000 };
// Looser than the per-email limit, same reasoning as login's IP check --
// guards against signup spam from one source across many different emails.
const SIGNUP_IP_RATE_LIMIT = { max: 20, windowMs: 60_000 };

export async function signupAction(
  _prevState: SignupFormState,
  formData: FormData,
): Promise<SignupFormState> {
  const t = getDictionary(await getRequestLocale());

  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: translateValidationMessage(parsed.error.issues[0]?.message ?? "", t) || t.common.invalidInput };
  }

  const { name, email, password } = parsed.data;

  const rateLimit = await checkRateLimit(`signup:${email.toLowerCase()}`, SIGNUP_RATE_LIMIT, {
    failClosed: true,
  });
  if (!rateLimit.allowed) {
    return { error: t.common.tooManyAttempts(rateLimit.retryAfterSeconds) };
  }
  const ipRateLimit = await checkRateLimit(`signup-ip:${await getClientIp()}`, SIGNUP_IP_RATE_LIMIT, {
    failClosed: true,
  });
  if (!ipRateLimit.allowed) {
    return { error: t.common.tooManyAttempts(ipRateLimit.retryAfterSeconds) };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: t.auth.signup.emailTaken };
  }

  const hashedPassword = await hashPassword(password);
  // Whatever the visitor was ALREADY seeing (landing/login/signup, via the
  // balboa-locale cookie -- e.g. they switched language before signing up,
  // or an E2E test pre-set it) carries over to the new account; a
  // brand-new visitor with no cookie yet gets Spanish, since the app is
  // built for the Panama market. See lib/i18n/locale.ts's own comment on
  // DEFAULT_LOCALE, and prisma/schema.prisma's comment on why the COLUMN
  // default itself stays EN (that default only ever applies to the
  // migration's own backfill of pre-existing accounts, never to a new
  // signup -- this is the only place new accounts get their locale).
  const locale = await getRequestLocale();
  try {
    // One transaction: a user with zero income categories (the seed
    // failing after the user row committed) can't complete onboarding's
    // income step, which has nothing to show in an empty picker.
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { name, email, hashedPassword, locale: locale.toUpperCase() as "EN" | "ES" },
      });
      // Income has no organic way to build up a category list the way
      // onboarding's expenses/savings steps do (add a fixed expense/goal)
      // -- seed a starting set so the picker isn't empty on day one.
      await seedDefaultIncomeCategories(tx, user.id);
    });
  } catch (error) {
    if (!isUniqueConstraintViolation(error)) throw error;
    // Lost the race to a concurrent signup with the same email (the check
    // above passed for both) -- the unique constraint on User.email
    // guarantees exactly one winner.
    return { error: t.auth.signup.emailTaken };
  }

  await signIn("credentials", { email, password, redirect: false });

  // Re-stamp the cookie to match what was just persisted -- a no-op when
  // it was already there (E2E's pre-set "en", or a real switcher choice),
  // but for the common no-cookie case this turns the implicit
  // DEFAULT_LOCALE fallback into an explicit value so it's no longer
  // dependent on that default staying "es" forever.
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  redirect("/");
}
