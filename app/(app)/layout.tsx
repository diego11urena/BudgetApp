import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { syncGmailTransactions } from "@/lib/gmail-sync";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import { getOrderedCategoryNames } from "@/lib/category-order";
import { formatCycleLabel } from "@/lib/pay-date";
import { BottomNav } from "./_components/BottomNav";
import { ToastProvider } from "./_components/ToastProvider";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { onboardingCompletedAt: true },
  });

  if (!user?.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  // Checks Gmail for new bank purchase notifications on every navigation
  // into the app, so a freshly-logged transaction shows up no matter which
  // tab is opened first — never throws (see syncGmailTransactions), so a
  // revoked token or a Gmail API hiccup can't break page loads.
  await syncGmailTransactions(userId);

  // Feeds the bottom nav's global "+" action sheet, which needs to open
  // QuickAddSheet from any page — same three fetches dashboard/page.tsx
  // and transactions/page.tsx already each make independently.
  const cycle = await getOrCreateDraftCycle(userId);
  const [expenseCategoryNames, savingsCategoryNames, incomeCategoryNames] = await Promise.all([
    getOrderedCategoryNames(userId, cycle.id, "EXPENSE"),
    getOrderedCategoryNames(userId, cycle.id, "SAVINGS"),
    getOrderedCategoryNames(userId, cycle.id, "INCOME"),
  ]);

  return (
    <ToastProvider>
      <div className="app-shell">
        <main className="app-content">{children}</main>
        <BottomNav
          expenseCategoryNames={expenseCategoryNames}
          savingsCategoryNames={savingsCategoryNames}
          incomeCategoryNames={incomeCategoryNames}
          cycleStartDate={formatCycleLabel(cycle.periodStart)}
        />
      </div>
    </ToastProvider>
  );
}
