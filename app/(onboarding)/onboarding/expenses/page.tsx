import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOnboardingStep } from "../_lib/getOnboardingState";
import { StepProgress } from "../_components/StepProgress";
import { LineItemsForm } from "../_components/LineItemsForm";
import { saveExpensesAction } from "./actions";

export default async function ExpensesStepPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const state = await requireOnboardingStep(session.user.id, "expenses");

  const existingGoals = await prisma.cycleBudgetGoal.findMany({
    where: { cycleId: state.cycle.id, expenseCategory: { type: "EXPENSE" } },
    include: { expenseCategory: true },
    orderBy: { createdAt: "asc" },
  });

  const initialItems = existingGoals.map((goal) => ({
    name: goal.expenseCategory.name,
    amount: goal.targetAmount.toString(),
  }));

  return (
    <div className="card card--wide">
      <StepProgress current="expenses" />
      <h1>Add your fixed expenses</h1>
      <p className="field-hint">
        Things you pay every cycle, like rent or subscriptions. Add as many as you need
        — you can always change these later.
      </p>
      <LineItemsForm
        action={saveExpensesAction}
        fieldName="itemsJson"
        itemNounSingular="fixed expense"
        amountLabel="Monthly amount (USD)"
        submitLabel="Continue"
        initialItems={initialItems}
      />
    </div>
  );
}
