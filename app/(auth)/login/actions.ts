"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";

export async function googleSignInAction(formData: FormData) {
  // The checkbox is also `required` client-side; this is the real gate.
  if (formData.get("terms") !== "on") redirect("/login?error=terms");
  await signIn("google", { redirectTo: "/" });
}
