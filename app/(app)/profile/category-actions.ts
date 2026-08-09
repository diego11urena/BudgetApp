"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidateAppPages } from "@/lib/revalidate";
import { categoryNameSchema } from "@/lib/validations/shared";

export async function renameCategoryAction(
  formData: FormData,
): Promise<{ error?: string } | undefined> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const categoryId = formData.get("categoryId");
  if (typeof categoryId !== "string" || !categoryId) {
    return { error: "Missing category" };
  }

  const parsed = categoryNameSchema.safeParse(formData.get("name"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid name" };
  }
  const name = parsed.data;

  // Ownership-scoped: findFirst by id+userId, not a plain findUnique(id),
  // so a user can't rename another user's category by guessing an id.
  const category = await prisma.expenseCategory.findFirst({ where: { id: categoryId, userId } });
  if (!category) {
    return { error: "Category not found" };
  }
  if (name === category.name) {
    return undefined;
  }

  const conflict = await prisma.expenseCategory.findFirst({
    where: { userId, name, type: category.type, NOT: { id: category.id } },
  });
  if (conflict) {
    return { error: `"${name}" already exists — merge into it instead of renaming.` };
  }

  await prisma.expenseCategory.update({ where: { id: category.id }, data: { name } });
  revalidateAppPages();
}

/**
 * Merges one category into another of the same type: every transaction and
 * budget-goal history row moves to the target, any per-cycle target amount
 * conflicts are summed rather than dropped, and the source category is
 * deleted. Irreversible — the caller is expected to confirm first.
 */
export async function mergeCategoryAction(
  formData: FormData,
): Promise<{ error?: string } | undefined> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const sourceCategoryId = formData.get("sourceCategoryId");
  const targetCategoryId = formData.get("targetCategoryId");
  if (typeof sourceCategoryId !== "string" || !sourceCategoryId) {
    return { error: "Missing category" };
  }
  if (typeof targetCategoryId !== "string" || !targetCategoryId) {
    return { error: "Pick a category to merge into" };
  }
  if (sourceCategoryId === targetCategoryId) {
    return { error: "Pick two different categories" };
  }

  const [source, target] = await Promise.all([
    prisma.expenseCategory.findFirst({ where: { id: sourceCategoryId, userId } }),
    prisma.expenseCategory.findFirst({ where: { id: targetCategoryId, userId } }),
  ]);
  if (!source || !target) {
    return { error: "Category not found" };
  }
  if (source.type !== target.type) {
    return { error: "Categories must be the same type to merge" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.cycleTransaction.updateMany({
      where: { expenseCategoryId: source.id },
      data: { expenseCategoryId: target.id },
    });

    // A cycle can only have one CycleBudgetGoal per category (unique
    // constraint) — if both source and target already had a target amount
    // set in the same cycle, sum them instead of dropping one silently.
    const sourceGoals = await tx.cycleBudgetGoal.findMany({
      where: { expenseCategoryId: source.id },
    });
    for (const goal of sourceGoals) {
      const existingTargetGoal = await tx.cycleBudgetGoal.findUnique({
        where: { cycleId_expenseCategoryId: { cycleId: goal.cycleId, expenseCategoryId: target.id } },
      });
      if (existingTargetGoal) {
        await tx.cycleBudgetGoal.update({
          where: { id: existingTargetGoal.id },
          data: { targetAmount: existingTargetGoal.targetAmount.add(goal.targetAmount) },
        });
        await tx.cycleBudgetGoal.delete({ where: { id: goal.id } });
      } else {
        await tx.cycleBudgetGoal.update({
          where: { id: goal.id },
          data: { expenseCategoryId: target.id },
        });
      }
    }

    // recurring: true if either side ever was. frequency/dueDay: MONTHLY
    // only ever arises from a deliberate choice (BIWEEKLY is always the
    // default), so prefer whichever side is MONTHLY over one still at the
    // default -- otherwise merging a MONTHLY category (e.g. Rent, due day
    // 1) into a still-default-BIWEEKLY one silently made it start carrying
    // forward every quincena instead of once a month, with no warning.
    // lifetimeTargetAmount (Goals only) sums like budget targets do above.
    const useSourceFrequency = target.frequency !== "MONTHLY" && source.frequency === "MONTHLY";
    const mergedLifetimeTarget =
      source.lifetimeTargetAmount !== null
        ? (target.lifetimeTargetAmount?.add(source.lifetimeTargetAmount) ?? source.lifetimeTargetAmount)
        : target.lifetimeTargetAmount;

    await tx.expenseCategory.update({
      where: { id: target.id },
      data: {
        recurring: target.recurring || source.recurring,
        frequency: useSourceFrequency ? source.frequency : target.frequency,
        dueDay: useSourceFrequency ? source.dueDay : target.dueDay,
        lifetimeTargetAmount: mergedLifetimeTarget,
      },
    });

    await tx.expenseCategory.delete({ where: { id: source.id } });
  });

  revalidateAppPages();
}
