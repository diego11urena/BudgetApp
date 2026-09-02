import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireOnboardingStep } from "../_lib/getOnboardingState";
import { StepProgress } from "../_components/StepProgress";
import { getOrderedCategoryNames } from "@/lib/category-order";
import { GoalStepForm } from "./_components/GoalStepForm";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getRequestLocale());
  return { title: t.onboarding.goal.metaTitle };
}

export default async function GoalStepPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const t = getDictionary(await getRequestLocale());

  const state = await requireOnboardingStep(session.user.id, "goal");
  const savingsCategoryNames = await getOrderedCategoryNames(session.user.id, state.cycle.id, "SAVINGS");

  return (
    <div className="card card--wide onboarding-shell">
      <StepProgress current="goal" />
      <p className="onboarding-kicker">{t.onboarding.goal.kicker}</p>
      <h1>{t.onboarding.goal.question}</h1>
      <p className="field-hint">{t.onboarding.goal.explainer}</p>
      <GoalStepForm savingsCategoryNames={savingsCategoryNames} />
    </div>
  );
}
