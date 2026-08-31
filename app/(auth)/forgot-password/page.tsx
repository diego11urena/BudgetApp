import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "../_components/AuthShell";

export const metadata: Metadata = { title: "Forgot password" };

/**
 * Honest placeholder -- the "Forgot?" link on /login needs to go
 * somewhere real, but the actual email/token reset flow (Resend
 * integration) is its own separate, not-yet-built task. This says so
 * plainly rather than faking a "check your email" flow that doesn't
 * send anything.
 */
export default function ForgotPasswordPage() {
  return (
    <AuthShell
      title="Password reset isn't available yet."
      subtitle="We're still building this. In the meantime, contact support and we'll help you back into your account."
    >
      <Link href="/login" className="button auth-submit" style={{ display: "flex" }}>
        Back to log in
      </Link>
    </AuthShell>
  );
}
