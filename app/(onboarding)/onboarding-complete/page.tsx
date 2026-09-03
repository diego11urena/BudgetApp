import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Image from "next/image";
import { auth } from "@/lib/auth";
import { CompleteRedirect } from "./_components/CompleteRedirect";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary, resolveVocab } from "@/lib/i18n/get-dictionary";
import { getUserPayFrequency } from "@/lib/cycles";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getRequestLocale());
  return { title: t.onboarding.complete.metaTitle };
}

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
  const t = getDictionary(await getRequestLocale());
  const vocab = resolveVocab(t, await getUserPayFrequency(session.user.id));

  return (
    <div className="onboarding-complete">
      <Image src="/balboa-logo.png" alt="" width={88} height={88} className="onboarding-complete-logo" priority />
      <h1>{t.onboarding.complete.title}</h1>
      <p>{t.onboarding.complete.redirecting(vocab)}</p>
      <CompleteRedirect />
    </div>
  );
}
