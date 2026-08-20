"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import { validateContributionDelta } from "@/lib/goals";
import { revalidateAppPages } from "@/lib/revalidate";
import { adjustGoalContributionSchema, goalSchema, updateGoalSchema } from "@/lib/validations/goals";

export type GoalFormState = { error?: string } | undefined;

/**
 * Creates a new goal (or resurrects a previously-removed one matching the
 * same name — see removeGoalAction, which never deletes the underlying
 * category). Editing an EXISTING goal by id goes through updateGoalAction
 * instead; this upsert-by-name behavior is only appropriate at creation
 * time, since a genuinely new goal has no id yet.
 */
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
    alreadySavedAmount: formData.get("alreadySavedAmount") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { name, lifetimeTargetAmount, recurringAmount, alreadySavedAmount } = parsed.data;

  // Setting/updating a goal implies the user wants it tracked going
  // forward — reinstates recurring in case this category was previously
  // removed (see removeGoalAction), so re-adding a goal doesn't silently
  // stay excluded from next cycle's carry-forward. alreadySavedAmount is
  // an opening balance (manualAdjustment), not a transaction -- only set
  // on the create branch, since re-submitting this same form for an
  // already-existing goal of the same name should never silently reset or
  // re-add to its tracked total.
  const category = await prisma.expenseCategory.upsert({
    where: { userId_name_type: { userId, name, type: "SAVINGS" } },
    create: {
      userId,
      name,
      type: "SAVINGS",
      lifetimeTargetAmount,
      recurring: true,
      manualAdjustment: alreadySavedAmount ?? 0,
    },
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

/**
 * Edits an existing goal by id — name, total target, per-cycle
 * contribution. Never touches savedSoFar (transactions + manualAdjustment)
 * -- that's adjustGoalContributionAction's job, kept separate so a plain
 * rename/retarget can't accidentally also touch the tracked total.
 */
export async function updateGoalAction(
  _prevState: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const parsed = updateGoalSchema.safeParse({
    categoryId: formData.get("categoryId"),
    name: formData.get("name"),
    lifetimeTargetAmount: formData.get("lifetimeTargetAmount"),
    recurringAmount: formData.get("recurringAmount") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { categoryId, name, lifetimeTargetAmount, recurringAmount } = parsed.data;

  // Ownership-scoped: only this user's own SAVINGS category, matching the
  // pattern every other by-id action in this app already uses.
  const existing = await prisma.expenseCategory.findFirst({
    where: { id: categoryId, userId, type: "SAVINGS" },
  });
  if (!existing) {
    return { error: "Goal not found" };
  }

  // A rename that collides with a DIFFERENT existing category (by the same
  // case-insensitive-unique rule getOrCreateCategory already enforces for
  // new categories) must error, not silently merge into that other row --
  // upsertGoalAction's upsert-by-name is fine for creation, but an
  // ID-scoped edit has to protect the specific row it's editing.
  if (name.toLowerCase() !== existing.name.toLowerCase()) {
    const collision = await prisma.expenseCategory.findFirst({
      where: { userId, type: "SAVINGS", name: { equals: name, mode: "insensitive" }, id: { not: categoryId } },
    });
    if (collision) {
      return { error: `A goal named "${collision.name}" already exists` };
    }
  }

  await prisma.expenseCategory.update({
    where: { id: categoryId },
    data: { name, lifetimeTargetAmount, recurring: true },
  });

  if (recurringAmount) {
    const cycle = await getOrCreateDraftCycle(userId);
    await prisma.cycleBudgetGoal.upsert({
      where: { cycleId_expenseCategoryId: { cycleId: cycle.id, expenseCategoryId: categoryId } },
      create: { cycleId: cycle.id, expenseCategoryId: categoryId, targetAmount: recurringAmount },
      update: { targetAmount: recurringAmount },
    });
  }

  revalidateAppPages();
}

export type AdjustContributionResult = { error: string } | { newSavedSoFar: number } | undefined;

/**
 * Adjusts a goal's manualAdjustment by a signed delta -- the "just update
 * the goal, don't log a transaction" half of editing "amount saved so
 * far" (see EditGoalSheet). The "record as transaction" half doesn't call
 * this at all; it goes through the ordinary addTransactionAction instead
 * (same as the existing Contribute button), so this action's only job is
 * the manualAdjustment term, never the transaction-sum term.
 *
 * Uses Prisma's atomic `increment` rather than read-current-then-write,
 * so this can never race with a concurrent edit or a concurrent
 * Contribute -- delta is exactly the change the client already computed
 * from values it just displayed, not a value that needs re-deriving here.
 */
export async function adjustGoalContributionAction(
  categoryId: string,
  delta: number,
): Promise<AdjustContributionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const parsed = adjustGoalContributionSchema.safeParse({ categoryId, delta });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const existing = await prisma.expenseCategory.findFirst({
    where: { id: categoryId, userId, type: "SAVINGS" },
    include: { transactions: { where: { type: "SAVINGS" } } },
  });
  if (!existing || existing.lifetimeTargetAmount === null) {
    return { error: "Goal not found" };
  }

  const transactionsTotal = existing.transactions.reduce((sum, tx) => sum + tx.amount.toNumber(), 0);
  const currentSavedSoFar = transactionsTotal + existing.manualAdjustment.toNumber();
  const validation = validateContributionDelta(currentSavedSoFar, parsed.data.delta);
  if (!validation.ok) {
    return { error: validation.error };
  }

  const updated = await prisma.expenseCategory.update({
    where: { id: categoryId },
    data: { manualAdjustment: { increment: parsed.data.delta } },
  });

  revalidateAppPages();

  return { newSavedSoFar: transactionsTotal + updated.manualAdjustment.toNumber() };
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
