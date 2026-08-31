import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DevResetButton } from "./_components/DevResetButton";
import { GmailRow } from "./_components/GmailRow";
import { EraseCyclesButton } from "./_components/EraseCyclesButton";
import { ChangePasswordSheet } from "./_components/ChangePasswordSheet";
import { signOutAction, logOutEverywhereAction } from "./actions";
import { resetOnboardingAction } from "./dev-actions";

export const metadata: Metadata = { title: "Profile" };

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

  const [user, gmailConnection, pastCycleCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, createdAt: true },
    }),
    prisma.gmailConnection.findUnique({
      where: { userId },
      select: { googleEmail: true, lastSyncedAt: true, lastSyncError: true },
    }),
    prisma.budgetCycle.count({ where: { userId, status: "CLOSED" } }),
  ]);

  const initial = user?.name?.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="home-page">
      <h1 className="page-title">Profile</h1>

      <div className="profile-identity">
        <span className="profile-avatar" aria-hidden="true">
          {initial}
        </span>
        <div>
          <p className="profile-name">{user?.name}</p>
          <p className="field-hint">{user?.email}</p>
          <p className="profile-member-since">
            Member since{" "}
            {user?.createdAt.toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      {(gmail === "error" || gmail === "rate_limited") && (
        <p className="error-text" style={{ marginBottom: "0.75rem" }}>
          {gmail === "error"
            ? "Couldn't connect Gmail — please try again."
            : "Too many attempts — please wait a minute and try again."}
        </p>
      )}

      <p className="profile-section-label">Your data</p>
      <div className="dashboard-section">
        <Link href="/history" className="line-item line-item--link">
          <span>Past quincenas</span>
          <span className="profile-row-trailing">
            {pastCycleCount > 0 && <span className="status-badge">{pastCycleCount}</span>}
            <ChevronRight size={18} aria-hidden="true" />
          </span>
        </Link>
        <GmailRow connection={gmailConnection} />
        <Link href="/profile/categories" className="line-item line-item--link">
          <span>Manage categories</span>
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
      </div>

      <p className="profile-section-label">Account</p>
      <div className="dashboard-section">
        <ChangePasswordSheet />
        <form action={logOutEverywhereAction}>
          <button type="submit" className="line-item line-item--link">
            <span>
              <span className="line-item-title">Sign out everywhere</span>
              <span className="field-hint">Use this if someone else may have access</span>
            </span>
          </button>
        </form>
      </div>

      <p className="profile-section-label profile-section-label--danger">Danger zone</p>
      <div className="dashboard-section">
        <EraseCyclesButton />
      </div>

      <form action={signOutAction} className="profile-signout-footer">
        <button type="submit" className="button profile-signout-button">
          Sign out
        </button>
      </form>

      {process.env.NODE_ENV !== "production" && (
        <div className="dashboard-section">
          <h2>Developer tools</h2>
          <DevResetButton action={resetOnboardingAction} />
        </div>
      )}
    </div>
  );
}
