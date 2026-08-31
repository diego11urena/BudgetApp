import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireOnboardingStep } from "../_lib/getOnboardingState";
import { StepProgress } from "../_components/StepProgress";
import { getOrderedCategoryNames } from "@/lib/category-order";
import { GoalStepForm } from "./_components/GoalStepForm";

export const metadata: Metadata = { title: "Savings goal" };

export default async function GoalStepPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const state = await requireOnboardingStep(session.user.id, "goal");
  const savingsCategoryNames = await getOrderedCategoryNames(session.user.id, state.cycle.id, "SAVINGS");

  return (
    <div className="card card--wide onboarding-shell">
      <StepProgress current="goal" />
      <p className="onboarding-kicker">Savings · optional</p>
      <h1>What are you saving for?</h1>
      <p className="field-hint">
        Skip this and add goals any time from Plan — nothing here is permanent.
      </p>
      <GoalStepForm savingsCategoryNames={savingsCategoryNames} />
    </div>
  );
}
