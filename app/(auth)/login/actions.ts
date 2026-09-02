"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/onboarding";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import type { ActionResult } from "@/lib/action-error";
import { LOCALE_COOKIE, getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { translateValidationMessage } from "@/lib/i18n/translate-validation-message";

export type LoginFormState = ActionResult | undefined;

const LOGIN_RATE_LIMIT = { max: 5, windowMs: 60_000 };
// Deliberately looser than the per-email limit -- one IP can legitimately
// be many real users behind NAT/a shared office connection. This exists to
// blunt a distributed attacker trying many different accounts from one
// source, which the per-email limit alone doesn't catch.
const LOGIN_IP_RATE_LIMIT = { max: 20, windowMs: 60_000 };

export async function loginAction(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const t = getDictionary(await getRequestLocale());

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: translateValidationMessage(parsed.error.issues[0]?.message ?? "", t) || t.common.invalidInput };
  }

  // Keyed by the submitted email -- blunts brute-forcing one account's
  // password. Also keyed by IP, separately, to blunt a distributed
  // attacker spreading guesses across many different accounts, which the
  // email-only check can't see (see LOGIN_IP_RATE_LIMIT above).
  const rateLimit = await checkRateLimit(`login:${parsed.data.email.toLowerCase()}`, LOGIN_RATE_LIMIT, {
    failClosed: true,
  });
  if (!rateLimit.allowed) {
    return { error: t.common.tooManyAttempts(rateLimit.retryAfterSeconds) };
  }
  const ipRateLimit = await checkRateLimit(`login-ip:${await getClientIp()}`, LOGIN_IP_RATE_LIMIT, {
    failClosed: true,
  });
  if (!ipRateLimit.allowed) {
    return { error: t.common.tooManyAttempts(ipRateLimit.retryAfterSeconds) };
  }

  try {
    await signIn("credentials", { ...parsed.data, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: t.auth.login.invalidCredentials };
    }
    throw error;
  }

  // A returning user logging in on a fresh browser (no cookie yet, or a
  // stale one) should immediately see the language actually stored on
  // their account, not whatever the anonymous-visitor default happens to
  // resolve to -- re-sync the cookie from the DB on every successful
  // login, the same read-cache-follows-source-of-truth pattern setThemeAction
  // and setLocaleAction use on an explicit change.
  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: { locale: true },
  });
  if (user) {
    const cookieStore = await cookies();
    cookieStore.set(LOCALE_COOKIE, user.locale.toLowerCase(), {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  redirect("/");
}
