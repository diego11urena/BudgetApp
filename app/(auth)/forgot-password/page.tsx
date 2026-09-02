import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "../_components/AuthShell";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getRequestLocale());
  return { title: t.auth.forgotPassword.metaTitle };
}

/**
 * Honest placeholder -- the "Forgot?" link on /login needs to go
 * somewhere real, but the actual email/token reset flow (Resend
 * integration) is its own separate, not-yet-built task. This says so
 * plainly rather than faking a "check your email" flow that doesn't
 * send anything.
 */
export default async function ForgotPasswordPage() {
  const t = getDictionary(await getRequestLocale());
  return (
    <AuthShell title={t.auth.forgotPassword.title} subtitle={t.auth.forgotPassword.subtitle}>
      <Link href="/login" className="button auth-submit" style={{ display: "flex" }}>
        {t.auth.forgotPassword.backToLogin}
      </Link>
    </AuthShell>
  );
}
