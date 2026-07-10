import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOnboardingStep } from "../_lib/getOnboardingState";
import { StepProgress } from "../_components/StepProgress";
import { IncomeForm } from "./IncomeForm";

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
    ? {
        name: existingEntry.incomeSource.name,
        grossMonthlyAmount: existingEntry.incomeSource.grossMonthlyAmount.toString(),
        isPanamaPayroll: existingEntry.incomeSource.isPanamaPayroll,
      }
    : undefined;

  return (
    <div className="card card--wide">
      <StepProgress current="income" />
      <h1>What&apos;s your income?</h1>
      <p className="field-hint">
        We&apos;ll use this to estimate your Panama payroll deductions (CSS, Seguro
        Educativo, ISR) and your take-home pay for {state.cycle.label}.
      </p>
      <IncomeForm cycleMonth={state.cycle.periodStart.getMonth() + 1} initial={initial} />
    </div>
  );
}
