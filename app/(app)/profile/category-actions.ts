"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
 * Edits an existing EXPENSE category's name, icon, and color together (the
 * Manage Categories "Edit" sheet). Separate from renameCategoryAction (kept
 * as-is for the lightweight Income page) so Income's simpler, already-
 * working path never has to change shape to accommodate icon/color.
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

  // Ownership- and type-scoped: only this user's own EXPENSE category.
  const category = await prisma.expenseCategory.findFirst({
    where: { id: categoryId, userId, type: "EXPENSE" },
  });
  if (!category) {
    return { error: "Category not found" };
  }

  if (name.toLowerCase() !== category.name.toLowerCase()) {
    const conflict = await prisma.expenseCategory.findFirst({
      where: { userId, type: "EXPENSE", name: { equals: name, mode: "insensitive" }, NOT: { id: category.id } },
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
 * Deletes an EXPENSE category outright — allowed regardless of usage (a
 * confirmed product decision, not an oversight): its transactions fall back
 * to "Uncategorized" via the schema's own onDelete: SetNull, and any budget-
 * goal history for it is gone via onDelete: Cascade. The caller (
 * DeleteCategoryConfirm) is responsible for warning about both consequences
 * before calling this — this action itself does no blocking/confirmation,
 * same "irreversible, caller confirms first" contract as mergeCategoryAction.
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

  const category = await prisma.expenseCategory.findFirst({
    where: { id: categoryId, userId, type: "EXPENSE" },
  });
  if (!category) {
    return { error: "Category not found" };
  }

  await prisma.expenseCategory.delete({ where: { id: category.id } });
  revalidateAppPages();
}
