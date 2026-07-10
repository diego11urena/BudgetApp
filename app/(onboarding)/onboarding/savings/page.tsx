import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireOnboardingStep } from "../_lib/getOnboardingState";
import { StepProgress } from "../_components/StepProgress";
import { LineItemsForm } from "../_components/LineItemsForm";
import { saveSavingsAction } from "./actions";

export default async function SavingsStepPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  await requireOnboardingStep(session.user.id, "savings");

  return (
    <div className="card card--wide">
      <StepProgress current="savings" />
      <h1>Set your savings goals</h1>
      <p className="field-hint">
        Anything you&apos;re saving toward this cycle. Optional — add as many as you
        need, or skip for now.
      </p>
      <LineItemsForm
        action={saveSavingsAction}
        fieldName="itemsJson"
        itemNounSingular="savings goal"
        amountLabel="Target amount (USD)"
        submitLabel="Finish setup"
      />
    </div>
  );
}
