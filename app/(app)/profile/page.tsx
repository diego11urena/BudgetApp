import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { IncomeSettingsForm } from "./_components/IncomeSettingsForm";
import { DevResetButton } from "./_components/DevResetButton";
import { ManageCategories } from "./_components/ManageCategories";
import { GmailConnectionCard } from "./_components/GmailConnectionCard";
import { EraseCyclesButton } from "./_components/EraseCyclesButton";
import { ChangePasswordForm } from "./_components/ChangePasswordForm";
import { signOutAction } from "./actions";
import { resetOnboardingAction } from "./dev-actions";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ gmail?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const { gmail } = await searchParams;

  const [user, incomeSource, categories, gmailConnection] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, createdAt: true },
    }),
    prisma.incomeSource.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.expenseCategory.findMany({
      where: { userId },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true },
    }),
    prisma.gmailConnection.findUnique({
      where: { userId },
      select: { googleEmail: true, lastSyncedAt: true, lastSyncError: true },
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

      <div className="dashboard-section">
        <h2>Password</h2>
        <ChangePasswordForm />
      </div>

      {incomeSource && (
        <div className="dashboard-section">
          <h2>Income</h2>
          <IncomeSettingsForm
            initial={{
              name: incomeSource.name,
              netQuincenaAmount: incomeSource.netQuincenaAmount.toString(),
            }}
          />
        </div>
      )}

      <div className="dashboard-section">
        <h2>Gmail import</h2>
        {gmail === "error" && (
          <p className="error-text" style={{ marginBottom: "0.75rem" }}>
            Couldn&apos;t connect Gmail — please try again.
          </p>
        )}
        <GmailConnectionCard connection={gmailConnection} />
      </div>

      <div className="dashboard-section">
        <h2>Manage categories</h2>
        <p className="field-hint" style={{ marginBottom: "0.75rem" }}>
          Rename a typo&apos;d category, or merge two into one — moves all its transactions and
          budget history along with it.
        </p>
        <ManageCategories categories={categories} />
      </div>

      <div className="dashboard-section">
        <h2>Reset</h2>
        <p className="field-hint" style={{ marginBottom: "0.75rem" }}>
          Wipe your quincena history and start fresh — your categories and income setup stay
          the same.
        </p>
        <EraseCyclesButton />
      </div>

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
