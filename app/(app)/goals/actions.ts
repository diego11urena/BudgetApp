"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import { revalidateAppPages } from "@/lib/revalidate";
import { goalSchema } from "@/lib/validations/goals";

export type GoalFormState = { error?: string } | undefined;

export async function upsertGoalAction(
  _prevState: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const parsed = goalSchema.safeParse({
    name: formData.get("name"),
    lifetimeTargetAmount: formData.get("lifetimeTargetAmount"),
    recurringAmount: formData.get("recurringAmount") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { name, lifetimeTargetAmount, recurringAmount } = parsed.data;

  // Setting/updating a goal implies the user wants it tracked going
  // forward — reinstates recurring in case this category was previously
  // removed (see removeGoalAction), so re-adding a goal doesn't silently
  // stay excluded from next cycle's carry-forward.
  const category = await prisma.expenseCategory.upsert({
    where: { userId_name_type: { userId, name, type: "SAVINGS" } },
    create: { userId, name, type: "SAVINGS", lifetimeTargetAmount, recurring: true },
    update: { lifetimeTargetAmount, recurring: true },
  });

  if (recurringAmount) {
    const cycle = await getOrCreateDraftCycle(userId);
    await prisma.cycleBudgetGoal.upsert({
      where: {
        cycleId_expenseCategoryId: { cycleId: cycle.id, expenseCategoryId: category.id },
      },
      create: { cycleId: cycle.id, expenseCategoryId: category.id, targetAmount: recurringAmount },
      update: { targetAmount: recurringAmount },
    });
  }

  revalidateAppPages();
}

export interface RemovedGoalSnapshot {
  categoryId: string;
  lifetimeTargetAmount: number;
  /** The current cycle's per-cycle contribution, if it had one set. */
  currentCycleContribution: { cycleId: string; targetAmount: number } | null;
}

/** Success carries a snapshot so a "Deleted · Undo" toast can restore it. */
export type RemoveGoalResult = { error: string } | { removed: RemovedGoalSnapshot } | undefined;

export async function removeGoalAction(formData: FormData): Promise<RemoveGoalResult> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const categoryId = formData.get("categoryId");
  if (typeof categoryId !== "string" || !categoryId) {
    return { error: "Missing goal" };
  }

  // Clears the goal target and stops it recurring, doesn't delete the
  // category — deleting would cascade/orphan real historical
  // CycleBudgetGoal and CycleTransaction rows.
  const category = await prisma.expenseCategory.findFirst({
    where: { id: categoryId, userId, type: "SAVINGS" },
    include: {
      budgetGoals: { where: { cycle: { userId, status: { in: ["DRAFT", "ACTIVE"] } } } },
    },
  });
  if (!category || category.lifetimeTargetAmount === null) {
    return { error: "Goal not found" };
  }

  const currentContribution = category.budgetGoals[0] ?? null;

  await prisma.$transaction([
    prisma.expenseCategory.update({
      where: { id: category.id },
      data: { lifetimeTargetAmount: null, recurring: false },
    }),
    // Also clear the current cycle's per-cycle contribution target — without
    // this, recurring:false only stops *future* carry-forward, but the
    // removed goal's number would still sit around for the cycle you're on.
    prisma.cycleBudgetGoal.deleteMany({
      where: { expenseCategoryId: category.id, cycle: { userId, status: { in: ["DRAFT", "ACTIVE"] } } },
    }),
  ]);

  revalidateAppPages();

  return {
    removed: {
      categoryId: category.id,
      lifetimeTargetAmount: category.lifetimeTargetAmount.toNumber(),
      currentCycleContribution: currentContribution
        ? { cycleId: currentContribution.cycleId, targetAmount: currentContribution.targetAmount.toNumber() }
        : null,
    },
  };
}

/**
 * Undo for a removed goal — reinstates lifetimeTargetAmount and recurring,
 * and if the current cycle had a per-cycle contribution set, restores that
 * too.
 */
export async function restoreGoalAction(formData: FormData): Promise<{ error?: string } | undefined> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const categoryId = formData.get("categoryId");
  const lifetimeTargetAmount = formData.get("lifetimeTargetAmount");
  const cycleId = formData.get("cycleId");
  const targetAmount = formData.get("targetAmount");

  if (
    typeof categoryId !== "string" ||
    !categoryId ||
    typeof lifetimeTargetAmount !== "string" ||
    !lifetimeTargetAmount
  ) {
    return { error: "Invalid undo payload" };
  }

  // Ownership-scoped: only restore this user's own goal category.
  const category = await prisma.expenseCategory.findFirst({
    where: { id: categoryId, userId, type: "SAVINGS" },
  });
  if (!category) {
    return { error: "Goal not found" };
  }

  await prisma.expenseCategory.update({
    where: { id: category.id },
    data: { lifetimeTargetAmount, recurring: true },
  });

  if (typeof cycleId === "string" && cycleId && typeof targetAmount === "string" && targetAmount) {
    const cycle = await prisma.budgetCycle.findFirst({ where: { id: cycleId, userId } });
    if (cycle) {
      await prisma.cycleBudgetGoal.upsert({
        where: { cycleId_expenseCategoryId: { cycleId, expenseCategoryId: category.id } },
        create: { cycleId, expenseCategoryId: category.id, targetAmount },
        update: { targetAmount },
      });
    }
  }

  revalidateAppPages();
}
