import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOnboardingStep } from "../_lib/getOnboardingState";
import { StepProgress } from "../_components/StepProgress";
import { RentStepForm } from "./_components/RentStepForm";
import { saveExpensesAction } from "./actions";

export const metadata: Metadata = { title: "Expenses" };

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

  const existingRent = existingGoals.find((g) => g.expenseCategory.name.toLowerCase() === "rent");

  return (
    <div className="card card--wide">
      <StepProgress current="expenses" />
      <h1>How much is your rent?</h1>
      <p className="field-hint">
        Everything else — subscriptions, groceries, whatever else you pay regularly — builds up
        on its own as you log it, or any time from Plan.
      </p>
      <RentStepForm action={saveExpensesAction} initialAmount={existingRent?.targetAmount.toString()} />
      {/* The single biggest labor-saving feature in the app previously went
          unmentioned anywhere in onboarding, only discoverable by
          stumbling into Profile -- see the Balboa fix list's batch 11.6. */}
      <p className="field-hint" style={{ marginTop: "1rem" }}>
        Tip: connect Gmail from Profile afterward to import transactions automatically instead of
        typing each one in.
      </p>
    </div>
  );
}
