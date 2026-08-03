"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import { budgetGoalSchema } from "@/lib/validations/budget";

export type BudgetGoalFormState = { error?: string } | undefined;

function revalidateAppPages() {
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/budget");
  revalidatePath("/goals");
}

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
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { name, targetAmount } = parsed.data;
  const cycle = await getOrCreateDraftCycle(userId);

  // Amount edits never touch `recurring` — that's a separate, category-level
  // setting changed only via toggleCategoryRecurringAction below, so editing
  // an existing target's amount here can't accidentally flip it.
  const category = await prisma.expenseCategory.upsert({
    where: { userId_name_type: { userId, name, type: "EXPENSE" } },
    create: { userId, name, type: "EXPENSE" },
    update: {},
  });

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
    return { error: "Missing target" };
  }

  // Ownership-scoped: a plain delete({ where: { id } }) would let a user
  // delete another user's row by guessing an id.
  const existing = await prisma.cycleBudgetGoal.findFirst({
    where: { id: goalId, cycle: { userId } },
  });
  if (!existing) {
    return { error: "Target not found" };
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
