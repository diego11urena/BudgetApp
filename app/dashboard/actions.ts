"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import { addTransactionSchema } from "@/lib/validations/transactions";

export type TransactionFormState = { error?: string } | undefined;

export async function addTransactionAction(
  _prevState: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const parsed = addTransactionSchema.safeParse({
    type: formData.get("type"),
    name: formData.get("name"),
    amount: formData.get("amount"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { type, name, amount } = parsed.data;
  const cycle = await getOrCreateDraftCycle(userId);

  let expenseCategoryId: string | null = null;
  if (type !== "INCOME") {
    const category = await prisma.expenseCategory.upsert({
      where: { userId_name: { userId, name } },
      create: { userId, name, type },
      update: {},
    });
    expenseCategoryId = category.id;
  }

  await prisma.cycleTransaction.create({
    data: { cycleId: cycle.id, type, name, amount, expenseCategoryId },
  });

  revalidatePath("/dashboard");
}

export async function deleteTransactionAction(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const transactionId = formData.get("transactionId");
  if (typeof transactionId !== "string" || !transactionId) {
    return;
  }

  // Scope the delete to this user's own cycles — a plain delete({ where: { id } })
  // would let a user delete another user's row by guessing an id.
  await prisma.cycleTransaction.deleteMany({
    where: { id: transactionId, cycle: { userId: session.user.id } },
  });

  revalidatePath("/dashboard");
}
