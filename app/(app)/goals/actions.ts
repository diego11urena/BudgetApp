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

  const category = await prisma.expenseCategory.upsert({
    where: { userId_name_type: { userId, name, type: "SAVINGS" } },
    create: { userId, name, type: "SAVINGS", lifetimeTargetAmount },
    update: { lifetimeTargetAmount },
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

  // Clears the goal target, doesn't delete the category — deleting would
  // cascade/orphan real historical CycleBudgetGoal and CycleTransaction rows.
  await prisma.expenseCategory.updateMany({
    where: { id: categoryId, userId },
    data: { lifetimeTargetAmount: null },
  });

  revalidateAppPages();
}
