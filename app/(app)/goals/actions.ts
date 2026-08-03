"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import { goalSchema } from "@/lib/validations/goals";

export type GoalFormState = { error?: string } | undefined;

function revalidateAppPages() {
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/budget");
  revalidatePath("/goals");
}

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

export async function removeGoalAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const categoryId = formData.get("categoryId");
  if (typeof categoryId !== "string" || !categoryId) {
    return;
  }

  // Clears the goal target and stops it recurring, doesn't delete the
  // category — deleting would cascade/orphan real historical
  // CycleBudgetGoal and CycleTransaction rows.
  const category = await prisma.expenseCategory.findFirst({
    where: { id: categoryId, userId, type: "SAVINGS" },
  });
  if (!category) {
    return;
  }

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
}
