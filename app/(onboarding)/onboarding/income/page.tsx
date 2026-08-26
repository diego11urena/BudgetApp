import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOnboardingStep } from "../_lib/getOnboardingState";
import { StepProgress } from "../_components/StepProgress";
import { IncomeForm } from "./IncomeForm";

export const metadata: Metadata = { title: "Income" };

export default async function IncomeStepPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const state = await requireOnboardingStep(session.user.id, "income");

  const existingEntry = await prisma.cycleIncomeEntry.findFirst({
    where: { cycleId: state.cycle.id },
    include: { incomeSource: true },
  });

  const initial = existingEntry?.incomeSource
    ? { netQuincenaAmount: existingEntry.incomeSource.netQuincenaAmount.toString() }
    : undefined;

  return (
    <div className="card card--wide">
      <StepProgress current="income" />
      <h1>What&apos;s your income?</h1>
      <p className="field-hint">
        Your take-home pay for each 15-day quincena — whatever actually deposits, after any
        deductions are already handled.
      </p>
      <IncomeForm initial={initial} />
    </div>
  );
}
