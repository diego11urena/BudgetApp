import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { IncomeSettingsForm } from "./_components/IncomeSettingsForm";
import { DevResetButton } from "./_components/DevResetButton";
import { signOutAction } from "./actions";
import { resetOnboardingAction } from "./dev-actions";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const [user, incomeSource] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, createdAt: true },
    }),
    prisma.incomeSource.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div className="home-page">
      <h1 className="page-title">Profile</h1>

      <div className="dashboard-section">
        <p className="profile-name">{user?.name}</p>
        <p className="field-hint">{user?.email}</p>
        <p className="field-hint" style={{ marginTop: "0.5rem" }}>
          Member since{" "}
          {user?.createdAt.toLocaleDateString("en-US", {
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      {incomeSource && (
        <div className="dashboard-section">
          <h2>Income</h2>
          <IncomeSettingsForm
            initial={{
              name: incomeSource.name,
              grossMonthlyAmount: incomeSource.grossMonthlyAmount.toString(),
              isPanamaPayroll: incomeSource.isPanamaPayroll,
            }}
          />
        </div>
      )}

      <div className="dashboard-section">
        <form action={signOutAction}>
          <button type="submit" className="button button--secondary">
            Sign out
          </button>
        </form>
      </div>

      {process.env.NODE_ENV !== "production" && (
        <div className="dashboard-section">
          <h2>Developer tools</h2>
          <DevResetButton action={resetOnboardingAction} />
        </div>
      )}
    </div>
  );
}
