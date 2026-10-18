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

/**
 * Records a prompt button's answer -- "No, both are real" (fingerprint
 * "*": never again), "Remind me tomorrow" (untilHours), and the like.
 */
export const rememberInsightAction = withActionErrorHandling(async function rememberInsightAction(input: {
  key: string;
  fingerprint: string;
  response: string;
  untilHours?: number;
}): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const { key, fingerprint, response, untilHours } = input;
  if (!key || key.length > 200 || fingerprint.length > 500 || !/^[a-z-]{1,40}$/.test(response)) return;
  const until = untilHours && untilHours > 0 && untilHours <= 24 * 60 ? new Date(Date.now() + untilHours * 3_600_000) : null;
  await rememberInsight(session.user.id, { key, fingerprint, response, until });
  revalidateAppPages();
});
