import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingCompletedAt: true },
  });

  if (user?.onboardingCompletedAt) {
    redirect("/dashboard");
  }

  return <main className="page-center">{children}</main>;
}
