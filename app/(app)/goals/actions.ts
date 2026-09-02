"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import { computeSavedSoFar, validateContributionDelta } from "@/lib/goals";
import { nowInPanama } from "@/lib/pay-date";
import { revalidateAppPages } from "@/lib/revalidate";
import { goalContributionDeltaSchema, goalSchema, updateGoalSchema } from "@/lib/validations/goals";
import { decimalString, INVALID_AMOUNT_FORMAT_MESSAGE } from "@/lib/validations/shared";
import { withActionErrorHandling, type ActionResult } from "@/lib/action-error";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { translateValidationMessage } from "@/lib/i18n/translate-validation-message";

export type GoalFormState = ActionResult | undefined;

/**
 * Creates a new goal (or resurrects a previously-removed one matching the
 * same name — see removeGoalAction, which never deletes the underlying
 * category). Editing an EXISTING goal by id goes through
 * updateGoalWithContributionAction instead; this upsert-by-name behavior
 * is only appropriate at creation time, since a genuinely new goal has no
 * id yet.
 */
export const upsertGoalAction = withActionErrorHandling(async function upsertGoalAction(
  _prevState: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const t = getDictionary(await getRequestLocale());

  const parsed = goalSchema.safeParse({
    name: formData.get("name"),
    lifetimeTargetAmount: formData.get("lifetimeTargetAmount"),
    recurringAmount: formData.get("recurringAmount") || undefined,
    alreadySavedAmount: formData.get("alreadySavedAmount") || undefined,
  });

  if (!parsed.success) {
    return { error: translateValidationMessage(parsed.error.issues[0]?.message ?? "", t) || t.common.invalidInput };
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
  await prisma.$transaction(async (tx) => {
    const category = await tx.expenseCategory.upsert({
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
      await tx.cycleBudgetGoal.upsert({
        where: {
          cycleId_expenseCategoryId: { cycleId: cycle.id, expenseCategoryId: category.id },
        },
        create: { cycleId: cycle.id, expenseCategoryId: category.id, targetAmount: recurringAmount },
        update: { targetAmount: recurringAmount },
      });
    }
  });

  revalidateAppPages();
});

class ContributionConcurrencyLostError extends Error {}

/**
 * EditGoalSheet's only server action — the base fields (name/target/
 * recurring) and, whenever savedSoFar also changed, the resulting
 * contribution write (either a real SAVINGS transaction or a
 * manualAdjustment correction) all happen inside one $transaction, instead
 * of two separate client-orchestrated round-trips (this used to be
 * updateGoalAction followed by addTransactionAction or
 * adjustGoalContributionAction). Previously, a failure on the second call
 * left the goal already renamed/retargeted with the contribution silently
 * dropped, and the UI only ever surfaced the second call's error.
 *
 * delta === 0 (savedSoFar untouched) still runs the base-field update, just
 * with no contribution write — the same single action covers both of
 * EditGoalSheet's submit paths.
 */
export const updateGoalWithContributionAction = withActionErrorHandling(async function updateGoalWithContributionAction(
  formData: FormData,
): Promise<GoalFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const t = getDictionary(await getRequestLocale());

  const parsed = updateGoalSchema.safeParse({
    categoryId: formData.get("categoryId"),
    name: formData.get("name"),
    lifetimeTargetAmount: formData.get("lifetimeTargetAmount"),
    recurringAmount: formData.get("recurringAmount") || undefined,
  });
  if (!parsed.success) {
    return { error: translateValidationMessage(parsed.error.issues[0]?.message ?? "", t) || t.common.invalidInput };
  }
  const { categoryId, name, lifetimeTargetAmount, recurringAmount } = parsed.data;

  const rawDelta = formData.get("delta");
  const deltaParsed = goalContributionDeltaSchema.safeParse(
    typeof rawDelta === "string" && rawDelta ? Number(rawDelta) : 0,
  );
  if (!deltaParsed.success) {
    return {
      error: translateValidationMessage(
        deltaParsed.error.issues[0]?.message ?? INVALID_AMOUNT_FORMAT_MESSAGE,
        t,
      ),
    };
  }
  const delta = deltaParsed.data;
  const recordAsTransaction = formData.get("recordAsTransaction") === "true";
  // A decrease recorded as a transaction is a withdrawal -- a real,
  // negative-amount SAVINGS CycleTransaction, not just a manualAdjustment
  // correction. Every downstream SAVINGS sum (computeSavedSoFar,
  // cycle-financials' totalSavings, the insights goal-contribution rule)
  // is a plain reduce, so a negative amount nets out correctly on its own;
  // only display code that assumed SAVINGS amounts are always positive
  // needed a matching fix (see TransactionList's AMOUNT_CLASS/sign logic).
  if (recordAsTransaction && delta === 0) {
    return { error: t.common.invalidInput };
  }

  // Ownership-scoped: only this user's own SAVINGS category, matching the
  // pattern every other by-id action in this app already uses.
  const existing = await prisma.expenseCategory.findFirst({
    where: { id: categoryId, userId, type: "SAVINGS" },
    include: { transactions: { where: { type: "SAVINGS" } } },
  });
  if (!existing) {
    return { error: t.goals.notFound };
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
      return { error: t.goals.nameTaken(collision.name) };
    }
  }

  if (delta !== 0 && !recordAsTransaction) {
    const currentSavedSoFar = computeSavedSoFar(existing.transactions, existing.manualAdjustment);
    const validation = validateContributionDelta(currentSavedSoFar, delta);
    if (!validation.ok) {
      return { error: validation.error };
    }
  }

  // Resolved once, outside the transaction below (getOrCreateDraftCycle
  // isn't tx-aware -- see its own cache() trap warning in lib/cycles.ts),
  // same pattern upsertGoalAction already uses for its own recurringAmount
  // write.
  const cycle = recurringAmount || (delta !== 0 && recordAsTransaction) ? await getOrCreateDraftCycle(userId) : null;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.expenseCategory.update({
        where: { id: categoryId },
        data: { name, lifetimeTargetAmount, recurring: true },
      });

      if (recurringAmount && cycle) {
        await tx.cycleBudgetGoal.upsert({
          where: { cycleId_expenseCategoryId: { cycleId: cycle.id, expenseCategoryId: categoryId } },
          create: { cycleId: cycle.id, expenseCategoryId: categoryId, targetAmount: recurringAmount },
          update: { targetAmount: recurringAmount },
        });
      }

      if (delta !== 0) {
        if (recordAsTransaction && cycle) {
          // Uses the just-submitted `name`, not existing.name -- the update
          // above may have just renamed this same category, and this
          // transaction should carry the current name forward. delta's own
          // sign carries through as-is: negative for a withdrawal, and
          // decimal.toFixed keeps that sign, so no separate "direction"
          // field is needed anywhere downstream -- the amount's sign IS
          // the direction, all the way down to TransactionList's display.
          await tx.cycleTransaction.create({
            data: {
              cycleId: cycle.id,
              userId,
              type: "SAVINGS",
              name: delta > 0 ? name : `${name} withdrawal`,
              amount: delta.toFixed(2),
              expenseCategoryId: categoryId,
              occurredAt: nowInPanama(),
            },
          });
        } else {
          // `updateMany` with a `manualAdjustment: currentAdjustment` guard,
          // not a blind atomic `increment` -- an atomic increment makes the
          // *write* race-free, but two concurrent decrements can still both
          // read the same pre-decrement savedSoFar, both pass
          // validateContributionDelta above, and leave the total negative
          // anyway. A losing concurrent writer's update matches zero rows
          // instead of silently corrupting the invariant already checked,
          // and throws to roll back the whole transaction -- committing the
          // base-field edit while dropping the contribution would defeat
          // the entire point of combining these into one transaction.
          const { count } = await tx.expenseCategory.updateMany({
            where: { id: categoryId, manualAdjustment: existing.manualAdjustment },
            data: { manualAdjustment: { increment: delta } },
          });
          if (count === 0) {
            throw new ContributionConcurrencyLostError();
          }
        }
      }
    });
  } catch (error) {
    if (error instanceof ContributionConcurrencyLostError) {
      return { error: t.goals.concurrentEdit };
    }
    throw error;
  }

  revalidateAppPages();
});

export interface RemovedGoalSnapshot {
  categoryId: string;
  lifetimeTargetAmount: number;
  /** The current cycle's per-cycle contribution, if it had one set. */
  currentCycleContribution: { cycleId: string; targetAmount: number } | null;
}

/** Success carries a snapshot so a "Deleted · Undo" toast can restore it. */
export type RemoveGoalResult = ActionResult<{ removed: RemovedGoalSnapshot }> | undefined;

export const removeGoalAction = withActionErrorHandling(async function removeGoalAction(
  formData: FormData,
): Promise<RemoveGoalResult> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const t = getDictionary(await getRequestLocale());

  const categoryId = formData.get("categoryId");
  if (typeof categoryId !== "string" || !categoryId) {
    return { error: t.goals.missingGoal };
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
    return { error: t.goals.notFound };
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
});

/**
 * Undo for a removed goal — reinstates lifetimeTargetAmount and recurring,
 * and if the current cycle had a per-cycle contribution set, restores that
 * too.
 */
export const restoreGoalAction = withActionErrorHandling(async function restoreGoalAction(
  formData: FormData,
): Promise<ActionResult | undefined> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const t = getDictionary(await getRequestLocale());

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
    return { error: t.goals.invalidUndoPayload };
  }
  // A toast's client-held snapshot resubmitted verbatim -- same untrusted-
  // input boundary the create/update forms already validate through, so
  // undo can't hand Decimal a value that overflows the column.
  const parsedLifetimeTarget = decimalString.safeParse(lifetimeTargetAmount);
  if (!parsedLifetimeTarget.success) {
    return {
      error: translateValidationMessage(
        parsedLifetimeTarget.error.issues[0]?.message ?? INVALID_AMOUNT_FORMAT_MESSAGE,
        t,
      ),
    };
  }
  let parsedTargetAmount: string | undefined;
  if (typeof targetAmount === "string" && targetAmount) {
    const result = decimalString.safeParse(targetAmount);
    if (!result.success) {
      return {
        error: translateValidationMessage(result.error.issues[0]?.message ?? INVALID_AMOUNT_FORMAT_MESSAGE, t),
      };
    }
    parsedTargetAmount = result.data;
  }

  // Ownership-scoped: only restore this user's own goal category.
  const category = await prisma.expenseCategory.findFirst({
    where: { id: categoryId, userId, type: "SAVINGS" },
  });
  if (!category) {
    return { error: t.goals.notFound };
  }

  await prisma.$transaction(async (tx) => {
    await tx.expenseCategory.update({
      where: { id: category.id },
      data: { lifetimeTargetAmount: parsedLifetimeTarget.data, recurring: true },
    });

    if (typeof cycleId === "string" && cycleId && parsedTargetAmount) {
      const cycle = await tx.budgetCycle.findFirst({ where: { id: cycleId, userId } });
      if (cycle) {
        await tx.cycleBudgetGoal.upsert({
          where: { cycleId_expenseCategoryId: { cycleId, expenseCategoryId: category.id } },
          create: { cycleId, expenseCategoryId: category.id, targetAmount: parsedTargetAmount },
          update: { targetAmount: parsedTargetAmount },
        });
      }
    }
  });

  revalidateAppPages();
});
