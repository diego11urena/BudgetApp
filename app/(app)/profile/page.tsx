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
import { ThemeRow } from "./_components/ThemeRow";
import { LanguageRow } from "./_components/LanguageRow";
import { PayFrequencyRow } from "./_components/PayFrequencyRow";
import { signOutAction, logOutEverywhereAction } from "./actions";
import { resetOnboardingAction } from "./dev-actions";
import type { ThemePreferenceValue } from "@/lib/theme";
import type { LocaleValue } from "@/lib/i18n/locale";
import type { PayFrequency } from "@/lib/quincena-pace";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getRequestLocale());
  return { title: t.profile.metaTitle };
}

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
  const locale = await getRequestLocale();
  const t = getDictionary(locale);

  const [user, gmailConnection, pastCycleCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, createdAt: true, theme: true, locale: true, payFrequency: true },
    }),
    prisma.gmailConnection.findUnique({
      where: { userId },
      select: { googleEmail: true, lastSyncedAt: true, lastSyncError: true },
    }),
    prisma.budgetCycle.count({ where: { userId, status: "CLOSED" } }),
  ]);

  const initial = user?.name?.trim().charAt(0).toUpperCase() || "?";
  const initialTheme = (user?.theme.toLowerCase() ?? "system") as ThemePreferenceValue;
  const initialLocale = (user?.locale.toLowerCase() ?? locale) as LocaleValue;
  const initialPayFrequency = (user?.payFrequency ?? "QUINCENAL") as PayFrequency;

  return (
    <div className="home-page">
      <h1 className="page-title">{t.profile.title}</h1>

      <div className="profile-identity">
        <span className="profile-avatar" aria-hidden="true">
          {initial}
        </span>
        <div>
          <p className="profile-name">{user?.name}</p>
          <p className="field-hint">{user?.email}</p>
          <p className="profile-member-since">
            {t.profile.memberSince(
              user?.createdAt.toLocaleDateString(locale === "es" ? "es-PA" : "en-US", {
                month: "long",
                year: "numeric",
              }) ?? "",
            )}
          </p>
        </div>
      </div>

      {(gmail === "error" || gmail === "rate_limited") && (
        <p className="error-text" style={{ marginBottom: "0.75rem" }}>
          {gmail === "error" ? t.profile.gmailError : t.profile.gmailRateLimited}
        </p>
      )}

      <p className="profile-section-label">{t.profile.yourData}</p>
      <div className="dashboard-section">
        <Link href="/history" className="line-item line-item--link">
          <span>{t.profile.pastQuincenas}</span>
          <span className="profile-row-trailing">
            {pastCycleCount > 0 && <span className="status-badge">{pastCycleCount}</span>}
            <ChevronRight size={18} aria-hidden="true" />
          </span>
        </Link>
        <GmailRow connection={gmailConnection} />
        <Link href="/profile/categories" className="line-item line-item--link">
          <span>{t.profile.manageCategories}</span>
          <ChevronRight size={18} aria-hidden="true" />
        </Link>
        <ThemeRow initialTheme={initialTheme} />
        <LanguageRow initialLocale={initialLocale} />
        <PayFrequencyRow initialPayFrequency={initialPayFrequency} />
      </div>

      <p className="profile-section-label">{t.profile.account}</p>
      <div className="dashboard-section">
        <ChangePasswordSheet />
        <form action={logOutEverywhereAction}>
          <button type="submit" className="line-item line-item--link">
            <span>
              <span className="line-item-title">{t.profile.signOutEverywhere}</span>
              <span className="field-hint">{t.profile.signOutEverywhereHint}</span>
            </span>
          </button>
        </form>
      </div>

      <p className="profile-section-label profile-section-label--danger">{t.profile.dangerZone}</p>
      <div className="dashboard-section">
        <EraseCyclesButton />
      </div>

      <form action={signOutAction} className="profile-signout-footer">
        <button type="submit" className="button profile-signout-button">
          {t.profile.signOut}
        </button>
      </form>

      {process.env.NODE_ENV !== "production" && (
        <div className="dashboard-section">
          <h2>{t.profile.developerTools}</h2>
          <DevResetButton action={resetOnboardingAction} />
        </div>
      )}
    </div>
  );
}
