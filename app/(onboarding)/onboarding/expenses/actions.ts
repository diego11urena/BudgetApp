"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftCycle, recomputeCategoryBudgetGoal } from "@/lib/cycles";
import { getOrCreateCategory } from "@/lib/categories";
import { budgetLineItemsSchema } from "@/lib/validations/onboarding";
import type { ActionResult } from "@/lib/action-error";

export type ExpensesFormState = ActionResult | undefined;

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

    // The deleteMany below cascades away every one of this user's EXPENSE
    // RecurringExpense rows' CycleRecurringExpense snapshots, in whichever
    // cycle(s) they happen to live -- not just this draft cycle. Onboarding
    // can't actually reach a second cycle in practice (closeCycleAndStart
    // Next requires onboardingCompletedAt, which this action itself sets at
    // the very end), so today that's always just this one cycle -- but
    // capturing every affected (cycle, category) pair here, not only this
    // cycle's, means the recompute loop below stays correct even if that
    // stops being true, instead of silently leaving some other cycle's
    // aggregate stale.
    const affectedCyclesToCategoryIds = new Map<string, Set<string>>();
    for (const snapshot of await tx.cycleRecurringExpense.findMany({
      where: { recurringExpense: { userId, category: { type: "EXPENSE" } } },
      select: { cycleId: true, recurringExpense: { select: { categoryId: true } } },
    })) {
      const categoryIds = affectedCyclesToCategoryIds.get(snapshot.cycleId) ?? new Set<string>();
      categoryIds.add(snapshot.recurringExpense.categoryId);
      affectedCyclesToCategoryIds.set(snapshot.cycleId, categoryIds);
    }
    const currentCycleCategoryIds = affectedCyclesToCategoryIds.get(cycle.id) ?? new Set<string>();
    for (const categoryId of previouslyAffectedCategoryIds) currentCycleCategoryIds.add(categoryId);
    affectedCyclesToCategoryIds.set(cycle.id, currentCycleCategoryIds);

    // Replace-all: a resubmission (e.g. after going back to edit) must drop
    // rows the user removed, not just upsert what's still present. Safe to
    // hard-delete here (unlike the "soft delete" recurring-actions.ts uses
    // post-onboarding) — nothing created during onboarding has any closed-
    // cycle history yet to preserve, since no cycle has ever closed.
    await tx.recurringExpense.deleteMany({ where: { userId, category: { type: "EXPENSE" } } });

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
      currentCycleCategoryIds.add(category.id);
    }

    await Promise.all(
      [...affectedCyclesToCategoryIds.entries()].flatMap(([cycleId, categoryIds]) =>
        [...categoryIds].map((categoryId) => recomputeCategoryBudgetGoal(tx, cycleId, categoryId)),
      ),
    );

    await tx.budgetCycle.update({
      where: { id: cycle.id },
      data: { expensesConfirmedAt: new Date(), status: "ACTIVE" },
    });

    await tx.user.update({
      where: { id: userId },
      data: { onboardingCompletedAt: new Date() },
    });
  });

  redirect("/dashboard");
}
