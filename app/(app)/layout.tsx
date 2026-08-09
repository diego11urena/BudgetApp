import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncGmailTransactions } from "@/lib/gmail-sync";
import { BottomNav } from "./_components/BottomNav";
import { ToastProvider } from "./_components/ToastProvider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingCompletedAt: true },
  });

  if (!user?.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  // Checks Gmail for new bank purchase notifications on every navigation
  // into the app, so a freshly-logged transaction shows up no matter which
  // tab is opened first — never throws (see syncGmailTransactions), so a
  // revoked token or a Gmail API hiccup can't break page loads.
  await syncGmailTransactions(session.user.id);

  return (
    <ToastProvider>
      <div className="app-shell">
        <main className="app-content">{children}</main>
        <BottomNav />
      </div>
    </ToastProvider>
  );
}
