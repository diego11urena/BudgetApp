"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { loginSchema } from "@/lib/validations/onboarding";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import type { ActionResult } from "@/lib/action-error";

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
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  // Keyed by the submitted email -- blunts brute-forcing one account's
  // password. Also keyed by IP, separately, to blunt a distributed
  // attacker spreading guesses across many different accounts, which the
  // email-only check can't see (see LOGIN_IP_RATE_LIMIT above).
  const rateLimit = await checkRateLimit(`login:${parsed.data.email.toLowerCase()}`, LOGIN_RATE_LIMIT, {
    failClosed: true,
  });
  if (!rateLimit.allowed) {
    return { error: `Too many attempts. Try again in ${rateLimit.retryAfterSeconds}s.` };
  }
  const ipRateLimit = await checkRateLimit(`login-ip:${await getClientIp()}`, LOGIN_IP_RATE_LIMIT, {
    failClosed: true,
  });
  if (!ipRateLimit.allowed) {
    return { error: `Too many attempts. Try again in ${ipRateLimit.retryAfterSeconds}s.` };
  }

  try {
    await signIn("credentials", { ...parsed.data, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password" };
    }
    throw error;
  }

  redirect("/");
}
