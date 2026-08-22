"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftCycle, recomputeCategoryBudgetGoal } from "@/lib/cycles";
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
    // Captured before the delete below so a category removed entirely from
    // this resubmission still gets its now-stale CycleBudgetGoal aggregate
    // cleared out, not left behind pointing at RecurringExpense rows that
    // no longer exist.
    const previouslyAffectedCategoryIds = (
      await tx.cycleBudgetGoal.findMany({
        where: { cycleId: cycle.id, expenseCategory: { type: "EXPENSE" } },
        select: { expenseCategoryId: true },
      })
    ).map((goal) => goal.expenseCategoryId);

    // Replace-all: a resubmission (e.g. after going back to edit) must drop
    // rows the user removed, not just upsert what's still present. Safe to
    // hard-delete here (unlike the "soft delete" recurring-actions.ts uses
    // post-onboarding) — nothing created during onboarding has any closed-
    // cycle history yet to preserve, since no cycle has ever closed.
    await tx.recurringExpense.deleteMany({ where: { userId, category: { type: "EXPENSE" } } });

    const affectedCategoryIds = new Set(previouslyAffectedCategoryIds);

    for (const item of parsed.data.items) {
      const category = await getOrCreateCategory(tx, userId, item.name, "EXPENSE");

      const recurringExpense = await tx.recurringExpense.create({
        data: {
          userId,
          categoryId: category.id,
          name: item.name,
          amount: item.targetAmount,
        },
      });
      await tx.cycleRecurringExpense.create({
        data: { cycleId: cycle.id, recurringExpenseId: recurringExpense.id, targetAmount: item.targetAmount },
      });
      affectedCategoryIds.add(category.id);
    }

    for (const categoryId of affectedCategoryIds) {
      await recomputeCategoryBudgetGoal(tx, cycle.id, categoryId);
    }

    await tx.budgetCycle.update({
      where: { id: cycle.id },
      data: { expensesConfirmedAt: new Date() },
    });
  });

  redirect("/onboarding/savings");
}
