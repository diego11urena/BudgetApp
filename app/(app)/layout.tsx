import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

  return (
    <ToastProvider>
      <div className="app-shell">
        <main className="app-content">{children}</main>
        <BottomNav />
      </div>
    </ToastProvider>
  );
}
