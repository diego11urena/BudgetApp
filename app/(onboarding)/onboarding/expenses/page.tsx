import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOnboardingStep } from "../_lib/getOnboardingState";
import { StepProgress } from "../_components/StepProgress";
import { RecurringExpensesStepForm, RecurringExpensesStepSkipButton } from "./_components/RecurringExpensesStepForm";
import { saveExpensesAction } from "./actions";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary, resolveVocab } from "@/lib/i18n/get-dictionary";
import { getUserBudgetFrequency } from "@/lib/cycles";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getRequestLocale());
  return { title: t.onboarding.expenses.metaTitle };
}

export default async function ExpensesStepPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const t = getDictionary(await getRequestLocale());
  const vocab = resolveVocab(t, await getUserBudgetFrequency(session.user.id));

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
    hasFixedDate: e.hasFixedDate,
    dueDay: e.dueDay !== null ? String(e.dueDay) : "",
  }));

  return (
    <div className="onboarding-shell onboarding-shell--expenses">
      <StepProgress current="expenses" />
      <p className="onboarding-kicker">{t.onboarding.expenses.kicker}</p>
      <h1>{t.onboarding.expenses.question(vocab)}</h1>
      <p className="onboarding-explainer">{t.onboarding.expenses.explainer(vocab)}</p>
      <RecurringExpensesStepForm action={saveExpensesAction} initialItems={initialItems} />
      <RecurringExpensesStepSkipButton action={saveExpensesAction} />
    </div>
  );
}
