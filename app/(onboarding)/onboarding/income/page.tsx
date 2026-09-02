import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOnboardingStep } from "../_lib/getOnboardingState";
import { StepProgress } from "../_components/StepProgress";
import { IncomeForm } from "./IncomeForm";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/get-dictionary";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getRequestLocale());
  return { title: t.onboarding.income.metaTitle };
}

export default async function IncomeStepPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const t = getDictionary(await getRequestLocale());

  const state = await requireOnboardingStep(session.user.id, "income");

  const existingEntry = await prisma.cycleIncomeEntry.findFirst({
    where: { cycleId: state.cycle.id },
    include: { incomeSource: true },
  });

  const initial = existingEntry?.incomeSource
    ? { netPayAmount: existingEntry.incomeSource.netPayAmount.toString() }
    : undefined;

  return (
    <div className="card card--wide onboarding-shell">
      <StepProgress current="income" />
      <p className="onboarding-kicker">{t.onboarding.income.kicker}</p>
      <h1>{t.onboarding.income.question}</h1>
      <p className="field-hint">{t.onboarding.income.explainer}</p>
      <IncomeForm initial={initial} />
    </div>
  );
}
