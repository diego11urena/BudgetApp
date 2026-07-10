import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getOnboardingState } from "./_lib/getOnboardingState";

export default async function OnboardingIndexPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const state = await getOnboardingState(session.user.id);
  redirect(state.nextStep ? `/onboarding/${state.nextStep}` : "/dashboard");
}
