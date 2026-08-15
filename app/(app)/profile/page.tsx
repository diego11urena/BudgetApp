import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DevResetButton } from "./_components/DevResetButton";
import { GmailConnectionCard } from "./_components/GmailConnectionCard";
import { EraseCyclesButton } from "./_components/EraseCyclesButton";
import { ChangePasswordSheet } from "./_components/ChangePasswordSheet";
import { EditIncomeSheet } from "./_components/EditIncomeSheet";
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

  const [user, incomeSource, gmailConnection] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, createdAt: true },
    }),
    prisma.incomeSource.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: "asc" },
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
        <ChangePasswordSheet />
      </div>

      {incomeSource && (
        <div className="dashboard-section">
          <EditIncomeSheet
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
        {gmail === "rate_limited" && (
          <p className="error-text" style={{ marginBottom: "0.75rem" }}>
            Too many attempts — please wait a minute and try again.
          </p>
        )}
        <GmailConnectionCard connection={gmailConnection} />
      </div>

      <div className="dashboard-section">
        <Link href="/profile/categories" className="line-item line-item--link">
          <span>Manage categories</span>
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
      </div>

      <div className="dashboard-section">
        <h2>History</h2>
        <Link href="/history" className="line-item line-item--link">
          <span>Past quincenas</span>
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
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
