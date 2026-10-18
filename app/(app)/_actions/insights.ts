"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { rememberInsight } from "@/lib/insight-memory";
import { revalidateAppPages } from "@/lib/revalidate";
import { withActionErrorHandling } from "@/lib/action-error";

/**
 * Hides an insight until its data changes (its fingerprint stops matching).
 * Used as a plain <form action>, so it works before hydration.
 */
export const dismissInsightAction = withActionErrorHandling(async function dismissInsightAction(
  formData: FormData,
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const key = formData.get("key");
  const fingerprint = formData.get("fingerprint");
  if (typeof key !== "string" || !key || key.length > 200 || typeof fingerprint !== "string" || fingerprint.length > 500) {
    return;
  }
  await rememberInsight(session.user.id, { key, fingerprint });
  revalidateAppPages();
});
