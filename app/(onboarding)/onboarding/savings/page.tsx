import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOnboardingStep } from "../_lib/getOnboardingState";
import { StepProgress } from "../_components/StepProgress";
import { LineItemsForm } from "../_components/LineItemsForm";
import { saveSavingsAction } from "./actions";

export default async function SavingsStepPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const state = await requireOnboardingStep(session.user.id, "savings");

  const existingGoals = await prisma.cycleBudgetGoal.findMany({
    where: { cycleId: state.cycle.id, expenseCategory: { type: "SAVINGS" } },
    include: { expenseCategory: true },
    orderBy: { createdAt: "asc" },
  });

  const initialItems = existingGoals.map((goal) => ({
    name: goal.expenseCategory.name,
    amount: goal.targetAmount.toString(),
  }));

  return (
    <div className="card card--wide">
      <StepProgress current="savings" />
      <h1>Set your savings goals</h1>
      <p className="field-hint">
        Anything you&apos;re saving toward this quincena. Optional — add as many as you
        need, or skip for now.
      </p>
      <LineItemsForm
        action={saveSavingsAction}
        fieldName="itemsJson"
        itemNounSingular="savings goal"
        amountLabel="Target amount (USD)"
        submitLabel="Finish setup"
        initialItems={initialItems}
      />
    </div>
  );
}
