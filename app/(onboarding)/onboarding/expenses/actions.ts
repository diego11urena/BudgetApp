"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import { getOrCreateCategory } from "@/lib/categories";
import { budgetLineItemsSchema } from "@/lib/validations/onboarding";

export type ExpensesFormState = { error?: string } | undefined;

export async function saveExpensesAction(
  _prevState: ExpensesFormState,
  formData: FormData,
): Promise<ExpensesFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const raw = formData.get("itemsJson");
  let rawItems: unknown;
  try {
    rawItems = JSON.parse(typeof raw === "string" ? raw : "[]");
  } catch {
    return { error: "Invalid submission" };
  }

  const parsed = budgetLineItemsSchema.safeParse({ items: rawItems });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const cycle = await getOrCreateDraftCycle(userId);

  await prisma.$transaction(async (tx) => {
    // Replace-all: a resubmission (e.g. after going back to edit) must drop
    // rows the user removed, not just upsert what's still present.
    await tx.cycleBudgetGoal.deleteMany({
      where: { cycleId: cycle.id, expenseCategory: { type: "EXPENSE" } },
    });

    for (const item of parsed.data.items) {
      const category = await getOrCreateCategory(tx, userId, item.name, "EXPENSE");

      await tx.cycleBudgetGoal.upsert({
        where: {
          cycleId_expenseCategoryId: { cycleId: cycle.id, expenseCategoryId: category.id },
        },
        create: {
          cycleId: cycle.id,
          expenseCategoryId: category.id,
          targetAmount: item.targetAmount,
        },
        update: { targetAmount: item.targetAmount },
      });
    }

    await tx.budgetCycle.update({
      where: { id: cycle.id },
      data: { expensesConfirmedAt: new Date() },
    });
  });

  redirect("/onboarding/savings");
}
