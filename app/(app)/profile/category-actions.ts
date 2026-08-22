"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recomputeCategoryBudgetGoal } from "@/lib/cycles";
import { revalidateAppPages } from "@/lib/revalidate";
import { categoryNameSchema } from "@/lib/validations/shared";
import { getIconByName } from "@/lib/category-icon-library";

const VALID_CATEGORY_COLOR = /^chart-cat-[1-8]$/;

/** null/undefined stays null (falls back to CategoryIcon's name heuristic); anything else must resolve in the icon library, or it's rejected rather than silently stored as a dead string. */
function parseIcon(value: FormDataEntryValue | null): { ok: true; icon: string | null } | { ok: false } {
  if (typeof value !== "string" || !value) return { ok: true, icon: null };
  if (!getIconByName(value)) return { ok: false };
  return { ok: true, icon: value };
}

function parseColor(value: FormDataEntryValue | null): { ok: true; color: string | null } | { ok: false } {
  if (typeof value !== "string" || !value) return { ok: true, color: null };
  if (!VALID_CATEGORY_COLOR.test(value)) return { ok: false };
  return { ok: true, color: value };
}

/** Edit/Delete are shared between Expense and Income (Savings deliberately excluded — it has its own dedicated flow on the Goals page, see goals/actions.ts) — every caller must say which type it's scoped to rather than this silently defaulting to one. */
function parseEditableType(value: FormDataEntryValue | null): "EXPENSE" | "INCOME" | null {
  return value === "EXPENSE" || value === "INCOME" ? value : null;
}

/**
 * Merges one category into another of the same type: every transaction
 * moves to the target, every recurring expense / budget-goal history row
 * moves to the target (EXPENSE categories move their RecurringExpense
 * children; INCOME/SAVINGS move CycleBudgetGoal rows directly), any
 * per-cycle target amount conflicts are summed rather than dropped, and the
 * source category is deleted. Irreversible — the caller is expected to
 * confirm first.
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

    if (source.type === "EXPENSE") {
      // EXPENSE categories' CycleBudgetGoal rows are a maintained aggregate
      // over RecurringExpense children now (see lib/cycles.ts), not
      // directly-owned data -- so merging moves the actual children
      // (RecurringExpense, whose own CycleRecurringExpense snapshots follow
      // via the FK) to the target category, then recomputes every cycle the
      // moved-in expenses ever had a snapshot in. A cycle where both source
      // and target already had recurring expenses ends up with both
      // contributions summed once recomputed, same "sum instead of drop"
      // outcome INCOME/SAVINGS goal-merging achieves directly below.
      const movedRecurringExpenseIds = (
        await tx.recurringExpense.findMany({ where: { categoryId: source.id }, select: { id: true } })
      ).map((r) => r.id);

      if (movedRecurringExpenseIds.length > 0) {
        await tx.recurringExpense.updateMany({
          where: { id: { in: movedRecurringExpenseIds } },
          data: { categoryId: target.id },
        });

        const snapshots = await tx.cycleRecurringExpense.findMany({
          where: { recurringExpenseId: { in: movedRecurringExpenseIds } },
          select: { cycleId: true },
        });
        const affectedCycleIds = new Set(snapshots.map((s) => s.cycleId));
        for (const cycleId of affectedCycleIds) {
          await recomputeCategoryBudgetGoal(tx, cycleId, target.id);
        }
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
}

/**
 * Creates a new EXPENSE category from the Manage Categories screen's
 * "+ Add category" flow — deliberately NOT getOrCreateCategory (that
 * function's job is silently resolving a free-text name to an existing
 * category from a transaction/budget context; this is an explicit,
 * user-driven "make a new one," so a name collision is a real error to
 * surface, not something to quietly paper over).
 */
export async function createCategoryAction(
  formData: FormData,
): Promise<{ error?: string } | undefined> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const parsedName = categoryNameSchema.safeParse(formData.get("name"));
  if (!parsedName.success) {
    return { error: parsedName.error.issues[0]?.message ?? "Invalid name" };
  }
  const name = parsedName.data;

  const parsedIcon = parseIcon(formData.get("icon"));
  if (!parsedIcon.ok) {
    return { error: "Invalid icon" };
  }
  const parsedColor = parseColor(formData.get("color"));
  if (!parsedColor.ok) {
    return { error: "Invalid color" };
  }

  const conflict = await prisma.expenseCategory.findFirst({
    where: { userId, type: "EXPENSE", name: { equals: name, mode: "insensitive" } },
  });
  if (conflict) {
    return { error: `"${conflict.name}" already exists` };
  }

  await prisma.expenseCategory.create({
    data: { userId, type: "EXPENSE", name, icon: parsedIcon.icon, color: parsedColor.color },
  });

  revalidateAppPages();
}

/**
 * Edits an existing Expense or Income category's name, icon, and color
 * together (the "Edit" sheet both types share — identical interaction on
 * both, just scoped by the `type` field the caller sends). Savings is
 * deliberately not reachable through this action; goals/actions.ts owns
 * that instead.
 */
export async function updateCategoryAction(
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
  const type = parseEditableType(formData.get("type"));
  if (!type) {
    return { error: "Invalid category type" };
  }

  const parsedName = categoryNameSchema.safeParse(formData.get("name"));
  if (!parsedName.success) {
    return { error: parsedName.error.issues[0]?.message ?? "Invalid name" };
  }
  const name = parsedName.data;

  const parsedIcon = parseIcon(formData.get("icon"));
  if (!parsedIcon.ok) {
    return { error: "Invalid icon" };
  }
  const parsedColor = parseColor(formData.get("color"));
  if (!parsedColor.ok) {
    return { error: "Invalid color" };
  }

  // Ownership- and type-scoped: only this user's own category of the type the caller claims.
  const category = await prisma.expenseCategory.findFirst({
    where: { id: categoryId, userId, type },
  });
  if (!category) {
    return { error: "Category not found" };
  }

  if (name.toLowerCase() !== category.name.toLowerCase()) {
    const conflict = await prisma.expenseCategory.findFirst({
      where: { userId, type, name: { equals: name, mode: "insensitive" }, NOT: { id: category.id } },
    });
    if (conflict) {
      return { error: `"${conflict.name}" already exists — merge into it instead of renaming.` };
    }
  }

  await prisma.expenseCategory.update({
    where: { id: category.id },
    data: { name, icon: parsedIcon.icon, color: parsedColor.color },
  });
  revalidateAppPages();
}

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
 */
export async function deleteCategoryAction(
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
  const type = parseEditableType(formData.get("type"));
  if (!type) {
    return { error: "Invalid category type" };
  }

  const category = await prisma.expenseCategory.findFirst({
    where: { id: categoryId, userId, type },
  });
  if (!category) {
    return { error: "Category not found" };
  }

  await prisma.expenseCategory.delete({ where: { id: category.id } });
  revalidateAppPages();
}
