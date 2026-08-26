"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidateAppPages } from "@/lib/revalidate";
import { withActionErrorHandling } from "@/lib/action-error";

export const disconnectGmailAction = withActionErrorHandling(async function disconnectGmailAction(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // Ownership-scoped: deleteMany by userId, not a plain delete by a guessed
  // connection id.
  await prisma.gmailConnection.deleteMany({ where: { userId: session.user.id } });

  revalidateAppPages();
});
