"use server";

import { redirect } from "next/navigation";
import type { Prisma } from "@/app/generated/prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUserPayFrequency, recomputeCategoryBudgetGoal } from "@/lib/cycles";
import { revalidateAppPages } from "@/lib/revalidate";
import { categoryNameSchema } from "@/lib/validations/shared";
import { getIconByName } from "@/lib/category-icon-library";
import { withActionErrorHandling, type ActionResult } from "@/lib/action-error";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary, resolveVocab } from "@/lib/i18n/get-dictionary";
import { translateValidationMessage } from "@/lib/i18n/translate-validation-message";

const MERGE_CATEGORY_RATE_LIMIT = { max: 10, windowMs: 60_000 };

/** null/undefined stays null (falls back to CategoryIcon's name heuristic); anything else must resolve in the icon library, or it's rejected rather than silently stored as a dead string. */
function parseIcon(value: FormDataEntryValue | null): { ok: true; icon: string | null } | { ok: false } {
  if (typeof value !== "string" || !value) return { ok: true, icon: null };
  if (!getIconByName(value)) return { ok: false };
  return { ok: true, icon: value };
}

/** Edit/Delete are shared between Expense and Income (Savings deliberately excluded — it has its own dedicated flow on the Goals page, see goals/actions.ts) — every caller must say which type it's scoped to rather than this silently defaulting to one. */
function parseEditableType(value: FormDataEntryValue | null): "EXPENSE" | "INCOME" | null {
  return value === "EXPENSE" || value === "INCOME" ? value : null;
}

/**
 * Moves every RecurringExpense from sourceCategoryId to targetCategoryId as
 * part of a category merge -- but a same-named pair (realistic: merging two
 * categories that both happen to include a "Netflix" line) is consolidated
 * into the target's existing one instead of producing a same-category
 * duplicate. Consolidating moves the source's CycleRecurringExpense
 * snapshots over (summing with the target's own snapshot in any cycle both
 * sides already had one, same "sum instead of drop" rule the rest of this
 * merge uses) and reassigns any CycleTransaction already linked to the
 * source recurring expense, before deleting the now-empty source row --
 * safe because its history has already been relocated, unlike a plain
 * user-initiated delete. Returns every cycle touched, for the caller to
 * recompute aggregates on.
 */
async function mergeCategoryRecurringExpenses(
  tx: Prisma.TransactionClient,
  sourceCategoryId: string,
  targetCategoryId: string,
): Promise<Set<string>> {
  const [sourceExpenses, targetExpenses] = await Promise.all([
    tx.recurringExpense.findMany({ where: { categoryId: sourceCategoryId } }),
    tx.recurringExpense.findMany({ where: { categoryId: targetCategoryId } }),
  ]);
  const targetByName = new Map(targetExpenses.map((e) => [e.name.trim().toLowerCase(), e]));
  const affectedCycleIds = new Set<string>();

  for (const sourceExpense of sourceExpenses) {
    const collision = targetByName.get(sourceExpense.name.trim().toLowerCase());

    if (!collision) {
      await tx.recurringExpense.update({
        where: { id: sourceExpense.id },
        data: { categoryId: targetCategoryId },
      });
      const snapshots = await tx.cycleRecurringExpense.findMany({
        where: { recurringExpenseId: sourceExpense.id },
        select: { cycleId: true },
      });
      snapshots.forEach((s) => affectedCycleIds.add(s.cycleId));
      continue;
    }

    const sourceSnapshots = await tx.cycleRecurringExpense.findMany({
      where: { recurringExpenseId: sourceExpense.id },
    });
    for (const snapshot of sourceSnapshots) {
      const existing = await tx.cycleRecurringExpense.findUnique({
        where: { cycleId_recurringExpenseId: { cycleId: snapshot.cycleId, recurringExpenseId: collision.id } },
      });
      if (existing) {
        await tx.cycleRecurringExpense.update({
          where: { id: existing.id },
          data: { targetAmount: existing.targetAmount.add(snapshot.targetAmount) },
        });
        await tx.cycleRecurringExpense.delete({ where: { id: snapshot.id } });
      } else {
        await tx.cycleRecurringExpense.update({
          where: { id: snapshot.id },
          data: { recurringExpenseId: collision.id },
        });
      }
      affectedCycleIds.add(snapshot.cycleId);
    }

    // Payment history already linked to the source recurring expense
    // follows it into the surviving one, not left dangling.
    await tx.cycleTransaction.updateMany({
      where: { recurringExpenseId: sourceExpense.id },
      data: { recurringExpenseId: collision.id },
    });

    // recurring: true if either side ever was -- same rule the category-
    // level merge below already applies to ExpenseCategory.recurring.
    if (sourceExpense.recurring && !collision.recurring) {
      await tx.recurringExpense.update({ where: { id: collision.id }, data: { recurring: true } });
    }

    await tx.recurringExpense.delete({ where: { id: sourceExpense.id } });
  }

  return affectedCycleIds;
}

/**
 * Merges one category into another of the same type: every transaction
 * moves to the target, every recurring expense / budget-goal history row
 * moves to the target (EXPENSE categories move their RecurringExpense
 * children -- consolidating any same-named pair instead of duplicating it,
 * see mergeCategoryRecurringExpenses; INCOME/SAVINGS move CycleBudgetGoal
 * rows directly), any per-cycle target amount conflicts are summed rather
 * than dropped, and the source category is deleted. Irreversible — the
 * caller is expected to confirm first.
 */
export const mergeCategoryAction = withActionErrorHandling(async function mergeCategoryAction(
  formData: FormData,
): Promise<ActionResult | undefined> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const t = getDictionary(await getRequestLocale());

  // The merge itself does N+1 work inside one transaction (see
  // mergeCategoryRecurringExpenses) -- worth throttling on its own,
  // separately from every other category action in this file.
  const rateLimit = await checkRateLimit(`merge-category:${userId}`, MERGE_CATEGORY_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return { error: t.common.tooManyAttempts(rateLimit.retryAfterSeconds) };
  }

  const sourceCategoryId = formData.get("sourceCategoryId");
  const targetCategoryId = formData.get("targetCategoryId");
  if (typeof sourceCategoryId !== "string" || !sourceCategoryId) {
    return { error: t.profile.categories.missingCategory };
  }
  if (typeof targetCategoryId !== "string" || !targetCategoryId) {
    return { error: t.profile.categories.merge.pickTarget };
  }
  if (sourceCategoryId === targetCategoryId) {
    return { error: t.profile.categories.merge.pickDifferentCategories };
  }

  const [source, target] = await Promise.all([
    prisma.expenseCategory.findFirst({ where: { id: sourceCategoryId, userId } }),
    prisma.expenseCategory.findFirst({ where: { id: targetCategoryId, userId } }),
  ]);
  if (!source || !target) {
    return { error: t.profile.categories.categoryNotFound };
  }
  if (source.type !== target.type) {
    return { error: t.profile.categories.merge.sameTypeRequired };
  }

  await prisma.$transaction(async (tx) => {
    await tx.cycleTransaction.updateMany({
      where: { expenseCategoryId: source.id },
      data: { expenseCategoryId: target.id },
    });

    if (source.type === "EXPENSE") {
      // EXPENSE categories' CycleBudgetGoal rows are a maintained aggregate
      // over RecurringExpense children now (see lib/cycles.ts), not
      // directly-owned data -- so merging moves the actual children
      // (consolidating any same-named pair instead of duplicating it) to
      // the target category, then recomputes every cycle touched.
      const affectedCycleIds = await mergeCategoryRecurringExpenses(tx, source.id, target.id);
      for (const cycleId of affectedCycleIds) {
        await recomputeCategoryBudgetGoal(tx, cycleId, target.id);
      }
      // source.id's own CycleBudgetGoal rows are cascade-deleted below
      // along with the category itself -- their RecurringExpense children
      // just moved away, so they're stale regardless.
    } else {
      // A cycle can only have one CycleBudgetGoal per category (unique
      // constraint) — if both source and target already had a target amount
      // set in the same cycle, sum them instead of dropping one silently.
      // INCOME categories (the only other type reachable here — SAVINGS has
      // its own dedicated merge-free flow on the Goals page) never actually
      // have CycleBudgetGoal rows, so this is a defensive no-op for them.
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
});

/**
 * Creates a new EXPENSE category from the Manage Categories screen's
 * "+ Add category" flow — deliberately NOT getOrCreateCategory (that
 * function's job is silently resolving a free-text name to an existing
 * category from a transaction/budget context; this is an explicit,
 * user-driven "make a new one," so a name collision is a real error to
 * surface, not something to quietly paper over).
 */
export const createCategoryAction = withActionErrorHandling(async function createCategoryAction(
  formData: FormData,
): Promise<ActionResult | undefined> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const t = getDictionary(await getRequestLocale());

  const parsedName = categoryNameSchema.safeParse(formData.get("name"));
  if (!parsedName.success) {
    return { error: translateValidationMessage(parsedName.error.issues[0]?.message ?? "", t) || t.common.invalidInput };
  }
  const name = parsedName.data;

  const parsedIcon = parseIcon(formData.get("icon"));
  if (!parsedIcon.ok) {
    return { error: t.profile.categories.form.invalidIcon };
  }

  const conflict = await prisma.expenseCategory.findFirst({
    where: { userId, type: "EXPENSE", name: { equals: name, mode: "insensitive" } },
  });
  if (conflict) {
    return { error: t.profile.categories.form.nameExists(conflict.name) };
  }

  await prisma.expenseCategory.create({
    data: { userId, type: "EXPENSE", name, icon: parsedIcon.icon },
  });

  revalidateAppPages();
});

/**
 * Edits an existing Expense or Income category's name and icon together
 * (the "Edit" sheet both types share — identical interaction on both, just
 * scoped by the `type` field the caller sends). Savings is deliberately not
 * reachable through this action; goals/actions.ts owns that instead.
 */
export const updateCategoryAction = withActionErrorHandling(async function updateCategoryAction(
  formData: FormData,
): Promise<ActionResult | undefined> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const t = getDictionary(await getRequestLocale());

  const categoryId = formData.get("categoryId");
  if (typeof categoryId !== "string" || !categoryId) {
    return { error: t.profile.categories.missingCategory };
  }
  const type = parseEditableType(formData.get("type"));
  if (!type) {
    return { error: t.profile.categories.invalidCategoryType };
  }

  const parsedName = categoryNameSchema.safeParse(formData.get("name"));
  if (!parsedName.success) {
    return { error: translateValidationMessage(parsedName.error.issues[0]?.message ?? "", t) || t.common.invalidInput };
  }
  const name = parsedName.data;

  const parsedIcon = parseIcon(formData.get("icon"));
  if (!parsedIcon.ok) {
    return { error: t.profile.categories.form.invalidIcon };
  }

  // Ownership- and type-scoped: only this user's own category of the type the caller claims.
  const category = await prisma.expenseCategory.findFirst({
    where: { id: categoryId, userId, type },
  });
  if (!category) {
    return { error: t.profile.categories.categoryNotFound };
  }

  if (name.toLowerCase() !== category.name.toLowerCase()) {
    const conflict = await prisma.expenseCategory.findFirst({
      where: { userId, type, name: { equals: name, mode: "insensitive" }, NOT: { id: category.id } },
    });
    if (conflict) {
      return { error: t.profile.categories.form.nameExistsMergeHint(conflict.name) };
    }
  }

  await prisma.expenseCategory.update({
    where: { id: category.id },
    data: { name, icon: parsedIcon.icon },
  });
  revalidateAppPages();
});

/**
 * Deletes an Expense or Income category outright — allowed regardless of
 * usage (a confirmed product decision, not an oversight): its transactions
 * fall back to "Uncategorized" via the schema's own onDelete: SetNull, and
 * any budget-goal history for it is gone via onDelete: Cascade (Income
 * categories never have budget-goal rows, so that clause is a no-op for
 * them). The caller (DeleteCategoryConfirm) is responsible for warning
 * about both consequences before calling this — this action itself does no
 * blocking/confirmation, same "irreversible, caller confirms first"
 * contract as mergeCategoryAction.
 *
 * One guard on top of that: an EXPENSE category whose recurring expenses
 * have real closed-cycle history is NOT freely deletable the way an
 * ordinary category is — that history is exactly what
 * deleteRecurringExpenseAction's soft-delete exists to protect, and this
 * category-level cascade would otherwise destroy it in one step (the
 * RecurringExpense/CycleRecurringExpense FK chain is onDelete: Cascade,
 * same as CycleBudgetGoal). A category with no such history (nothing but
 * this-cycle-only recurring expenses, or none at all) still deletes freely
 * — there's nothing there worth blocking over.
 */
export const deleteCategoryAction = withActionErrorHandling(async function deleteCategoryAction(
  formData: FormData,
): Promise<ActionResult | undefined> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const t = getDictionary(await getRequestLocale());

  const categoryId = formData.get("categoryId");
  if (typeof categoryId !== "string" || !categoryId) {
    return { error: t.profile.categories.missingCategory };
  }
  const type = parseEditableType(formData.get("type"));
  if (!type) {
    return { error: t.profile.categories.invalidCategoryType };
  }

  const category = await prisma.expenseCategory.findFirst({
    where: { id: categoryId, userId, type },
  });
  if (!category) {
    return { error: t.profile.categories.categoryNotFound };
  }

  if (type === "EXPENSE") {
    const closedCycleHistoryCount = await prisma.cycleRecurringExpense.count({
      where: { recurringExpense: { categoryId: category.id }, cycle: { status: "CLOSED" } },
    });
    if (closedCycleHistoryCount > 0) {
      return { error: t.profile.categories.deleteConfirm.hasRecurringHistory(resolveVocab(t, await getUserPayFrequency(userId))) };
    }
  }

  await prisma.expenseCategory.delete({ where: { id: category.id } });
  revalidateAppPages();
});
