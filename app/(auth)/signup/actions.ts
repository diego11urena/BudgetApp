"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { signIn } from "@/lib/auth";
import { signupSchema } from "@/lib/validations/onboarding";
import { checkRateLimit } from "@/lib/rate-limit";

export type SignupFormState = { error?: string } | undefined;

const SIGNUP_RATE_LIMIT = { max: 5, windowMs: 60_000 };

export async function signupAction(
  _prevState: SignupFormState,
  formData: FormData,
): Promise<SignupFormState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { name, email, password } = parsed.data;

  const rateLimit = checkRateLimit(`signup:${email.toLowerCase()}`, SIGNUP_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return { error: `Too many attempts. Try again in ${rateLimit.retryAfterSeconds}s.` };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists" };
  }

  const hashedPassword = await hashPassword(password);
  await prisma.user.create({ data: { name, email, hashedPassword } });

  await signIn("credentials", { email, password, redirect: false });

  redirect("/");
}
