import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOnboardingStep } from "../_lib/getOnboardingState";
import { StepProgress } from "../_components/StepProgress";
import { BillsStepForm, BillsStepSkipButton } from "./_components/BillsStepForm";
import { saveExpensesAction } from "./actions";

export const metadata: Metadata = { title: "Bills" };

export default async function ExpensesStepPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  await requireOnboardingStep(session.user.id, "expenses");

  // Pre-fill from whatever's currently saved (a resubmission after going
  // back), not the seeded example -- matches exactly what saveExpensesAction
  // itself creates from this same items[] shape.
  const existing = await prisma.recurringExpense.findMany({
    where: { userId: session.user.id, category: { type: "EXPENSE" } },
    orderBy: { createdAt: "asc" },
  });

  const initialItems = existing.map((e) => ({
    name: e.name,
    amount: e.amount.toString(),
    dueDay: e.dueDay !== null ? String(e.dueDay) : "",
  }));

  return (
    <div className="card card--wide onboarding-shell">
      <StepProgress current="expenses" />
      <p className="onboarding-kicker">Bills</p>
      <h1>What do you pay regularly?</h1>
      <p className="field-hint">
        Rent, subscriptions, utilities — anything that repeats every quincena. Add as many as you
        want, or none.
      </p>
      <BillsStepForm action={saveExpensesAction} initialItems={initialItems} />
      <BillsStepSkipButton action={saveExpensesAction} />
    </div>
  );
}
