import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { requireOnboardingStep } from "../_lib/getOnboardingState";
import { StepProgress } from "../_components/StepProgress";
import { AccountsForm } from "./AccountsForm";

export default async function AccountsStepPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  await requireOnboardingStep(session.user.id, "accounts");

  return (
    <div className="card card--wide">
      <StepProgress current="accounts" />
      <h1>Add your accounts and balances</h1>
      <p className="field-hint">
        Add checking/savings/cash balances and any debts (credit cards, loans) to establish
        your starting point.
      </p>
      <AccountsForm />
    </div>
  );
}
