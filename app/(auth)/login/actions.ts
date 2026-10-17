"use server";

import { signIn } from "@/lib/auth";

export async function googleSignInAction() {
  await signIn("google", { redirectTo: "/" });
}
