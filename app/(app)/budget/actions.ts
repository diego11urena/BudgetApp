"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Marks the Recurring Expenses tab's explainer tooltip as seen, so it never
 * auto-opens again for this user (tap-to-reopen via the ⓘ button still
 * works regardless). Called once, right when the tooltip auto-opens for
 * the first time — not on dismiss — so navigating away mid-tooltip still
 * counts as "shown," matching "auto-show once ever."
 */
export async function markFixedExpenseHintSeenAction(): Promise<void> {
  const session = await auth();
  // No redirect("/login") here, unlike this app's other actions -- this
  // fires from a client-side useEffect on mount, not a user-initiated
  // form submit, so a missing session should just no-op rather than
  // yanking the user to /login as a side effect of an incidental
  // background call.
  if (!session?.user?.id) {
    return;
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { seenFixedExpenseHintAt: new Date() },
  });
}
