import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOnboardingStep } from "../_lib/getOnboardingState";
import { StepProgress } from "../_components/StepProgress";
import { DEFAULT_CATEGORIES } from "@/lib/default-categories";
import { ExpensesForm } from "./ExpensesForm";

export default async function ExpensesStepPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  await requireOnboardingStep(userId, "expenses");

  let categories = await prisma.expenseCategory.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  if (categories.length === 0) {
    await prisma.expenseCategory.createMany({
      data: DEFAULT_CATEGORIES.map((c) => ({
        userId,
        name: c.name,
        type: c.type,
        isDefault: true,
      })),
    });
    categories = await prisma.expenseCategory.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
    });
  }

  return (
    <div className="card card--wide">
      <StepProgress current="expenses" />
      <h1>Set your budget categories</h1>
      <p className="field-hint">
        Set a target amount for each category this cycle. Add more if you need to.
      </p>
      <ExpensesForm
        categories={categories.map((c) => ({ id: c.id, name: c.name, type: c.type }))}
      />
    </div>
  );
}
