import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { CompleteRedirect } from "./_components/CompleteRedirect";

export const metadata: Metadata = { title: "You're set" };

/**
 * Outside app/(onboarding)/onboarding/layout.tsx on purpose -- that layout
 * redirects away the instant user.onboardingCompletedAt is set (which the
 * goal step's action just did right before redirecting here), so this
 * screen has to live at a sibling path, not nested under onboarding/, or
 * it would never actually render.
 */
export default async function OnboardingCompletePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="onboarding-complete">
      <Image src="/balboa-logo.png" alt="" width={88} height={88} className="onboarding-complete-logo" priority />
      <h1>You&apos;re set.</h1>
      <p>Redirecting to /dashboard for this quincena.</p>
      <CompleteRedirect />
    </div>
  );
}
