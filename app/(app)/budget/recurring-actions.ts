"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftCycle, recomputeCategoryBudgetGoal } from "@/lib/cycles";
import { getOrCreateCategory } from "@/lib/categories";
import { nowInPanama } from "@/lib/pay-date";
import { revalidateAppPages } from "@/lib/revalidate";
import { recurringExpenseSchema } from "@/lib/validations/budget";
import { decimalString } from "@/lib/validations/shared";
import { paymentMethodSchema } from "@/lib/validations/transactions";

export type RecurringExpenseFormState =
  | { error?: string; field?: "name" | "amount" | "categoryName" | "dueDay" }
  | undefined;

/** Name/amount/category/frequency/due-day, all in one sheet -- replaces the old "create a target, then separately set its frequency" two-step flow. */
export async function createRecurringExpenseAction(
  _prevState: RecurringExpenseFormState,
  formData: FormData,
): Promise<RecurringExpenseFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const parsed = recurringExpenseSchema.safeParse({
    name: formData.get("name"),
    amount: formData.get("amount"),
    categoryName: formData.get("categoryName"),
    frequency: formData.get("frequency") || "BIWEEKLY",
    dueDay: formData.get("dueDay") || undefined,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      error: issue?.message ?? "Invalid input",
      field: issue?.path[0] as "name" | "amount" | "categoryName" | "dueDay" | undefined,
    };
  }
  const { name, amount, categoryName, frequency, dueDay } = parsed.data;

  const cycle = await getOrCreateDraftCycle(userId);
  const category = await getOrCreateCategory(prisma, userId, categoryName, "EXPENSE");

  await prisma.$transaction(async (tx) => {
    const recurringExpense = await tx.recurringExpense.create({
      data: {
        userId,
        categoryId: category.id,
        name,
        amount,
        frequency,
        dueDay: frequency === "MONTHLY" ? dueDay : null,
      },
    });

    await tx.cycleRecurringExpense.create({
      data: { cycleId: cycle.id, recurringExpenseId: recurringExpense.id, targetAmount: amount },
    });

    await recomputeCategoryBudgetGoal(tx, cycle.id, category.id);
  });

  revalidateAppPages();
}

/**
 * Amount/category edits behave differently by design: amount is a "price"
 * (like a category's old targetAmount) -- it updates *this cycle's* own
 * snapshot immediately but never rewrites a past cycle's already-closed
 * numbers, matching CycleRecurringExpense's whole reason for existing.
 * Category is an identity/label, more like renaming a category -- it
 * applies uniformly to every cycle this recurring expense has ever
 * appeared in, same as renaming a category retroactively relabels its
 * past history too.
 */
export async function updateRecurringExpenseAction(
  _prevState: RecurringExpenseFormState,
  formData: FormData,
): Promise<RecurringExpenseFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Missing recurring expense" };
  }

  // Ownership-scoped: a plain update({ where: { id } }) would let a user
  // edit another user's row by guessing an id.
  const existing = await prisma.recurringExpense.findFirst({ where: { id, userId } });
  if (!existing) {
    return { error: "Recurring expense not found" };
  }

  const parsed = recurringExpenseSchema.safeParse({
    name: formData.get("name"),
    amount: formData.get("amount"),
    categoryName: formData.get("categoryName"),
    frequency: formData.get("frequency") || "BIWEEKLY",
    dueDay: formData.get("dueDay") || undefined,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      error: issue?.message ?? "Invalid input",
      field: issue?.path[0] as "name" | "amount" | "categoryName" | "dueDay" | undefined,
    };
  }
  const { name, amount, categoryName, frequency, dueDay } = parsed.data;
  const recurring = formData.get("recurring") !== "false";

  const category = await getOrCreateCategory(prisma, userId, categoryName, "EXPENSE");
  const cycle = await getOrCreateDraftCycle(userId);
  const categoryChanged = category.id !== existing.categoryId;

  await prisma.$transaction(async (tx) => {
    await tx.recurringExpense.update({
      where: { id: existing.id },
      data: {
        name,
        amount,
        categoryId: category.id,
        frequency,
        dueDay: frequency === "MONTHLY" ? dueDay : null,
        recurring,
      },
    });

    // Upsert, not update: a recurring expense that predates this cycle's
    // carry-forward (or was just toggled back on) may not have a snapshot
    // here yet.
    await tx.cycleRecurringExpense.upsert({
      where: { cycleId_recurringExpenseId: { cycleId: cycle.id, recurringExpenseId: existing.id } },
      create: { cycleId: cycle.id, recurringExpenseId: existing.id, targetAmount: amount },
      update: { targetAmount: amount },
    });

    if (categoryChanged) {
      const snapshots = await tx.cycleRecurringExpense.findMany({
        where: { recurringExpenseId: existing.id },
        select: { cycleId: true },
      });
      const affectedCycleIds = new Set(snapshots.map((s) => s.cycleId));
      affectedCycleIds.add(cycle.id);
      for (const affectedCycleId of affectedCycleIds) {
        await recomputeCategoryBudgetGoal(tx, affectedCycleId, existing.categoryId);
        await recomputeCategoryBudgetGoal(tx, affectedCycleId, category.id);
      }
    } else {
      await recomputeCategoryBudgetGoal(tx, cycle.id, category.id);
    }
  });

  revalidateAppPages();
}

export interface DeletedRecurringExpenseSnapshot {
  recurringExpenseId: string;
  cycleId: string;
  targetAmount: number;
}

/** Success carries a snapshot so a "Deleted · Undo" toast can restore it. */
export type DeleteRecurringExpenseResult =
  | { error: string }
  | { deleted: DeletedRecurringExpenseSnapshot }
  | undefined;

export async function deleteRecurringExpenseAction(
  _prevState: DeleteRecurringExpenseResult,
  formData: FormData,
): Promise<DeleteRecurringExpenseResult> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) {
    return { error: "Missing recurring expense" };
  }

  const existing = await prisma.recurringExpense.findFirst({ where: { id, userId } });
  if (!existing) {
    return { error: "Recurring expense not found" };
  }

  const cycle = await getOrCreateDraftCycle(userId);
  const currentSnapshot = await prisma.cycleRecurringExpense.findUnique({
    where: { cycleId_recurringExpenseId: { cycleId: cycle.id, recurringExpenseId: existing.id } },
  });

  await prisma.$transaction(async (tx) => {
    // Soft delete only -- never a hard delete of the RecurringExpense row
    // itself, which would cascade away every closed cycle's historical
    // snapshot along with it (History must keep showing accurate past
    // breakdowns even after something is discontinued). This stops future
    // carry-forward and removes it from *this* cycle's own budget; a
    // recurring expense with no closed-cycle history left over just
    // becomes an inert, invisible row, which is harmless and simpler than
    // branching delete behavior on whether history exists yet.
    await tx.recurringExpense.update({ where: { id: existing.id }, data: { recurring: false } });
    await tx.cycleRecurringExpense.deleteMany({
      where: { cycleId: cycle.id, recurringExpenseId: existing.id },
    });
    await recomputeCategoryBudgetGoal(tx, cycle.id, existing.categoryId);
  });

  revalidateAppPages();

  return {
    deleted: {
      recurringExpenseId: existing.id,
      cycleId: cycle.id,
      targetAmount: (currentSnapshot?.targetAmount ?? existing.amount).toNumber(),
    },
  };
}

/** Undo for a deleted recurring expense — flips `recurring` back on and restores this cycle's snapshot. */
export async function restoreRecurringExpenseAction(
  formData: FormData,
): Promise<{ error?: string } | undefined> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const recurringExpenseId = formData.get("recurringExpenseId");
  const cycleId = formData.get("cycleId");
  const targetAmount = formData.get("targetAmount");
  if (
    typeof recurringExpenseId !== "string" ||
    !recurringExpenseId ||
    typeof cycleId !== "string" ||
    !cycleId ||
    typeof targetAmount !== "string" ||
    !targetAmount
  ) {
    return { error: "Invalid undo payload" };
  }

  // Ownership-scoped, same reasoning as every other action here.
  const existing = await prisma.recurringExpense.findFirst({ where: { id: recurringExpenseId, userId } });
  if (!existing) {
    return { error: "Recurring expense not found" };
  }
  const cycle = await prisma.budgetCycle.findFirst({ where: { id: cycleId, userId } });
  if (!cycle) {
    return { error: "Cycle not found" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.recurringExpense.update({ where: { id: existing.id }, data: { recurring: true } });
    await tx.cycleRecurringExpense.upsert({
      where: { cycleId_recurringExpenseId: { cycleId: cycle.id, recurringExpenseId: existing.id } },
      create: { cycleId: cycle.id, recurringExpenseId: existing.id, targetAmount },
      update: { targetAmount },
    });
    await recomputeCategoryBudgetGoal(tx, cycle.id, existing.categoryId);
  });

  revalidateAppPages();
}

export type RecordPaymentResult = { error: string } | { transactionId: string } | undefined;

/** Logs a real CycleTransaction for this cycle's payment of a recurring expense — amount pre-filled from the recurring expense's own amount but editable, so a bill that came in slightly different than usual is still recorded accurately. */
export async function recordRecurringExpensePaymentAction(
  _prevState: RecordPaymentResult,
  formData: FormData,
): Promise<RecordPaymentResult> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const recurringExpenseId = formData.get("recurringExpenseId");
  if (typeof recurringExpenseId !== "string" || !recurringExpenseId) {
    return { error: "Missing recurring expense" };
  }

  const existing = await prisma.recurringExpense.findFirst({ where: { id: recurringExpenseId, userId } });
  if (!existing) {
    return { error: "Recurring expense not found" };
  }

  const amountRaw = formData.get("amount");
  const parsedAmount = decimalString.safeParse(
    typeof amountRaw === "string" && amountRaw ? amountRaw : existing.amount.toString(),
  );
  if (!parsedAmount.success) {
    return { error: parsedAmount.error.issues[0]?.message ?? "Invalid amount" };
  }

  const paymentMethodParsed = paymentMethodSchema.safeParse(formData.get("paymentMethod"));
  const paymentMethod = paymentMethodParsed.success ? paymentMethodParsed.data : null;

  const cycle = await getOrCreateDraftCycle(userId);

  const created = await prisma.cycleTransaction.create({
    data: {
      cycleId: cycle.id,
      type: "EXPENSE",
      name: existing.name,
      amount: parsedAmount.data,
      expenseCategoryId: existing.categoryId,
      recurringExpenseId: existing.id,
      paymentMethod,
      occurredAt: nowInPanama(),
    },
    select: { id: true },
  });

  revalidateAppPages();

  return { transactionId: created.id };
}

/**
 * Confirms a best-effort match suggestion (see lib/recurring-expense-matching.ts)
 * -- the user always confirms or dismisses, never an automatic silent link.
 * Dismissing a suggestion is local UI state only, not persisted here.
 */
export async function confirmRecurringExpenseMatchAction(
  formData: FormData,
): Promise<{ error?: string } | undefined> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const transactionId = formData.get("transactionId");
  const recurringExpenseId = formData.get("recurringExpenseId");
  if (typeof transactionId !== "string" || !transactionId) {
    return { error: "Missing transaction" };
  }
  if (typeof recurringExpenseId !== "string" || !recurringExpenseId) {
    return { error: "Missing recurring expense" };
  }

  // Ownership- and cycle-scoped: both rows must belong to this user, and
  // must actually share a category, or a stale/tampered client payload
  // could link a payment to an unrelated recurring expense.
  const [transaction, recurringExpense] = await Promise.all([
    prisma.cycleTransaction.findFirst({ where: { id: transactionId, cycle: { userId } } }),
    prisma.recurringExpense.findFirst({ where: { id: recurringExpenseId, userId } }),
  ]);
  if (!transaction) {
    return { error: "Transaction not found" };
  }
  if (!recurringExpense) {
    return { error: "Recurring expense not found" };
  }
  if (transaction.expenseCategoryId !== recurringExpense.categoryId) {
    return { error: "That transaction isn't in this recurring expense's category" };
  }

  await prisma.cycleTransaction.update({
    where: { id: transaction.id },
    data: { recurringExpenseId: recurringExpense.id },
  });

  revalidateAppPages();
}
