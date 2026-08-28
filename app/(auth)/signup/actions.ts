"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { signIn } from "@/lib/auth";
import { signupSchema } from "@/lib/validations/onboarding";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { seedDefaultIncomeCategories } from "@/lib/categories";
import { isUniqueConstraintViolation } from "@/lib/prisma-errors";
import type { ActionResult } from "@/lib/action-error";

export type SignupFormState = ActionResult | undefined;

const SIGNUP_RATE_LIMIT = { max: 5, windowMs: 60_000 };
// Looser than the per-email limit, same reasoning as login's IP check --
// guards against signup spam from one source across many different emails.
const SIGNUP_IP_RATE_LIMIT = { max: 20, windowMs: 60_000 };

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

  const rateLimit = await checkRateLimit(`signup:${email.toLowerCase()}`, SIGNUP_RATE_LIMIT, {
    failClosed: true,
  });
  if (!rateLimit.allowed) {
    return { error: `Too many attempts. Try again in ${rateLimit.retryAfterSeconds}s.` };
  }
  const ipRateLimit = await checkRateLimit(`signup-ip:${await getClientIp()}`, SIGNUP_IP_RATE_LIMIT, {
    failClosed: true,
  });
  if (!ipRateLimit.allowed) {
    return { error: `Too many attempts. Try again in ${ipRateLimit.retryAfterSeconds}s.` };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with that email already exists" };
  }

  const hashedPassword = await hashPassword(password);
  try {
    // One transaction: a user with zero income categories (the seed
    // failing after the user row committed) can't complete onboarding's
    // income step, which has nothing to show in an empty picker.
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name, email, hashedPassword } });
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
    return { error: "An account with that email already exists" };
  }

  await signIn("credentials", { email, password, redirect: false });

  redirect("/");
}
