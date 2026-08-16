"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import { getOrCreateCategory } from "@/lib/categories";
import { revalidateAppPages } from "@/lib/revalidate";
import { budgetGoalSchema, recurringFrequencySchema } from "@/lib/validations/budget";

export type BudgetGoalFormState = { error?: string; field?: "name" | "targetAmount" } | undefined;

export async function upsertBudgetGoalAction(
  _prevState: BudgetGoalFormState,
  formData: FormData,
): Promise<BudgetGoalFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const parsed = budgetGoalSchema.safeParse({
    name: formData.get("name"),
    targetAmount: formData.get("targetAmount"),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue?.message ?? "Invalid input", field: issue?.path[0] as "name" | "targetAmount" | undefined };
  }

  const { name, targetAmount } = parsed.data;
  const cycle = await getOrCreateDraftCycle(userId);

  // Amount edits never touch `recurring` — that's a separate, category-level
  // setting changed only via toggleCategoryRecurringAction below, so editing
  // an existing target's amount here can't accidentally flip it.
  const category = await getOrCreateCategory(prisma, userId, name, "EXPENSE");

  await prisma.cycleBudgetGoal.upsert({
    where: {
      cycleId_expenseCategoryId: { cycleId: cycle.id, expenseCategoryId: category.id },
    },
    create: { cycleId: cycle.id, expenseCategoryId: category.id, targetAmount },
    update: { targetAmount },
  });

  revalidateAppPages();
}

export async function toggleCategoryRecurringAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const categoryId = formData.get("categoryId");
  const recurring = formData.get("recurring") === "true";
  if (typeof categoryId !== "string" || !categoryId) {
    return;
  }

  // Ownership-scoped: a plain update({ where: { id } }) would let a user
  // toggle another user's category by guessing an id.
  await prisma.expenseCategory.updateMany({
    where: { id: categoryId, userId: session.user.id },
    data: { recurring },
  });

  revalidateAppPages();
}

/**
 * Sets how a recurring category's target carries forward: BIWEEKLY (every
 * cycle) or MONTHLY (only the one quincena matching dueDay). See
 * shouldCarryForwardToCycle in lib/cycles.ts for where this is consumed.
 */
export async function updateCategoryFrequencyAction(
  formData: FormData,
): Promise<{ error?: string } | undefined> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const categoryId = formData.get("categoryId");
  if (typeof categoryId !== "string" || !categoryId) {
    return { error: "Missing category" };
  }

  const parsed = recurringFrequencySchema.safeParse({
    frequency: formData.get("frequency"),
    dueDay: formData.get("dueDay") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { frequency, dueDay } = parsed.data;

  // Ownership-scoped, same reasoning as toggleCategoryRecurringAction above.
  await prisma.expenseCategory.updateMany({
    where: { id: categoryId, userId: session.user.id },
    data: { frequency, dueDay: frequency === "MONTHLY" ? dueDay : null },
  });

  revalidateAppPages();
}

export interface DeletedBudgetGoalSnapshot {
  cycleId: string;
  expenseCategoryId: string;
  targetAmount: number;
}

/** Success carries a snapshot so a "Deleted · Undo" toast can restore it. */
export type DeleteBudgetGoalResult = { error: string } | { deleted: DeletedBudgetGoalSnapshot } | undefined;

export async function deleteBudgetGoalAction(formData: FormData): Promise<DeleteBudgetGoalResult> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const goalId = formData.get("goalId");
  if (typeof goalId !== "string" || !goalId) {
    return { error: "Missing fixed expense" };
  }

  // Ownership-scoped: a plain delete({ where: { id } }) would let a user
  // delete another user's row by guessing an id.
  const existing = await prisma.cycleBudgetGoal.findFirst({
    where: { id: goalId, cycle: { userId } },
  });
  if (!existing) {
    return { error: "Fixed expense not found" };
  }

  await prisma.cycleBudgetGoal.delete({ where: { id: existing.id } });

  revalidateAppPages();

  return {
    deleted: {
      cycleId: existing.cycleId,
      expenseCategoryId: existing.expenseCategoryId,
      targetAmount: existing.targetAmount.toNumber(),
    },
  };
}

/** Undo for a deleted budget target — recreates it with its original cycle, category, and amount. */
export async function restoreBudgetGoalAction(
  formData: FormData,
): Promise<{ error?: string } | undefined> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const cycleId = formData.get("cycleId");
  const expenseCategoryId = formData.get("expenseCategoryId");
  const targetAmount = formData.get("targetAmount");

  if (
    typeof cycleId !== "string" ||
    !cycleId ||
    typeof expenseCategoryId !== "string" ||
    !expenseCategoryId ||
    typeof targetAmount !== "string" ||
    !targetAmount
  ) {
    return { error: "Invalid undo payload" };
  }

  // Ownership-scoped: only restore into a cycle that belongs to this user.
  const cycle = await prisma.budgetCycle.findFirst({ where: { id: cycleId, userId } });
  if (!cycle) {
    return { error: "Cycle not found" };
  }

  await prisma.cycleBudgetGoal.upsert({
    where: { cycleId_expenseCategoryId: { cycleId, expenseCategoryId } },
    create: { cycleId, expenseCategoryId, targetAmount },
    update: { targetAmount },
  });

  revalidateAppPages();
}
