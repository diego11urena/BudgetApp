"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { loginSchema } from "@/lib/validations/onboarding";
import { checkRateLimit } from "@/lib/rate-limit";

export type LoginFormState = { error?: string } | undefined;

const LOGIN_RATE_LIMIT = { max: 5, windowMs: 60_000 };

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

  // Keyed by the submitted email, not IP — blunts brute-forcing one
  // account's password without needing to plumb through client IPs.
  const rateLimit = checkRateLimit(`login:${parsed.data.email.toLowerCase()}`, LOGIN_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return { error: `Too many attempts. Try again in ${rateLimit.retryAfterSeconds}s.` };
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
