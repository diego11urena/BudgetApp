"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { rememberInsight } from "@/lib/insight-memory";
import { revalidateAppPages } from "@/lib/revalidate";
import { withActionErrorHandling } from "@/lib/action-error";
import { prisma } from "@/lib/prisma";
import { getOrCreateCategory } from "@/lib/categories";
import { getOrCreateDraftCycle, linkOrCreateRecurringExpenseForTransaction, recomputeCategoryBudgetGoal } from "@/lib/cycles";
import { panamaDateParts } from "@/lib/pay-date";
import { decimalString } from "@/lib/validations/shared";

/**
 * Hides an insight until its data changes (its fingerprint stops matching).
 * Used as a plain <form action>, so it works before hydration.
 */
export const dismissInsightAction = withActionErrorHandling(async function dismissInsightAction(
  formData: FormData,
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const key = formData.get("key");
  const fingerprint = formData.get("fingerprint");
  if (typeof key !== "string" || !key || key.length > 200 || typeof fingerprint !== "string" || fingerprint.length > 500) {
    return;
  }
  await rememberInsight(session.user.id, { key, fingerprint });
  revalidateAppPages();
});

/**
 * Records a prompt button's answer -- "No, both are real" (fingerprint
 * "*": never again), "Remind me tomorrow" (untilHours), and the like.
 */
export const rememberInsightAction = withActionErrorHandling(async function rememberInsightAction(input: {
  key: string;
  fingerprint: string;
  response: string;
  untilHours?: number;
}): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const { key, fingerprint, response, untilHours } = input;
  if (!key || key.length > 200 || fingerprint.length > 500 || !/^[a-z-]{1,40}$/.test(response)) return;
  const until = untilHours && untilHours > 0 && untilHours <= 24 * 60 ? new Date(Date.now() + untilHours * 3_600_000) : null;
  await rememberInsight(session.user.id, { key, fingerprint, response, until });
  revalidateAppPages();
});

/**
 * "Add to Recurring" for a suspected recurring charge: makes the
 * transaction's merchant a recurring expense charged on that day of the
 * month, and links the transaction to it.
 */
export const addTransactionToRecurringAction = withActionErrorHandling(async function addTransactionToRecurringAction(
  transactionId: string,
): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const transaction = await prisma.cycleTransaction.findFirst({
    where: { id: transactionId, cycle: { userId }, type: "EXPENSE" },
  });
  if (!transaction) return;

  await prisma.$transaction(async (tx) => {
    const categoryId =
      transaction.expenseCategoryId ?? (await getOrCreateCategory(tx, userId, transaction.name, "EXPENSE")).id;
    if (!transaction.expenseCategoryId) {
      await tx.cycleTransaction.update({ where: { id: transaction.id }, data: { expenseCategoryId: categoryId } });
    }
    await linkOrCreateRecurringExpenseForTransaction(tx, {
      userId,
      transactionId: transaction.id,
      categoryId,
      cycleId: transaction.cycleId,
      name: transaction.name,
      amount: transaction.amount,
    });
    const linked = await tx.cycleTransaction.findUniqueOrThrow({ where: { id: transaction.id }, select: { recurringExpenseId: true } });
    if (linked.recurringExpenseId) {
      await tx.recurringExpense.update({
        where: { id: linked.recurringExpenseId },
        data: { dueDay: panamaDateParts(transaction.occurredAt).day },
      });
    }
  });
  revalidateAppPages();
});

/** "Update recurring amount" after a price change: the saved amount and this cycle's target follow the new price. */
export const updateRecurringAmountAction = withActionErrorHandling(async function updateRecurringAmountAction(input: {
  recurringExpenseId: string;
  amount: string;
}): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const amount = decimalString.safeParse(input.amount);
  if (!amount.success) return;
  const existing = await prisma.recurringExpense.findFirst({ where: { id: input.recurringExpenseId, userId } });
  if (!existing) return;
  const cycle = await getOrCreateDraftCycle(userId);

  await prisma.$transaction(async (tx) => {
    await tx.recurringExpense.update({ where: { id: existing.id }, data: { amount: amount.data } });
    await tx.cycleRecurringExpense.updateMany({
      where: { cycleId: cycle.id, recurringExpenseId: existing.id },
      data: { targetAmount: amount.data },
    });
    await recomputeCategoryBudgetGoal(tx, cycle.id, existing.categoryId);
  });
  revalidateAppPages();
});

/**
 * Moves a closed cycle's leftover into a goal: a savings contribution
 * logged in that closed cycle, on its last day. The leftover never rolled
 * into the current cycle, so taking it from there would count it twice.
 */
export const moveClosedLeftoverToGoalAction = withActionErrorHandling(async function moveClosedLeftoverToGoalAction(input: {
  cycleId: string;
  goalName: string;
  amount: string;
}): Promise<{ transactionId: string } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const amount = decimalString.safeParse(input.amount);
  if (!amount.success) return { error: amount.error.issues[0]?.message ?? "Invalid amount" };
  const [cycle, goal] = await Promise.all([
    prisma.budgetCycle.findFirst({ where: { id: input.cycleId, userId, status: "CLOSED" } }),
    prisma.expenseCategory.findFirst({ where: { userId, type: "SAVINGS", name: input.goalName } }),
  ]);
  if (!cycle || !goal) return { error: "Not found" };
  const created = await prisma.cycleTransaction.create({
    data: {
      cycleId: cycle.id,
      userId,
      type: "SAVINGS",
      name: goal.name,
      amount: amount.data,
      expenseCategoryId: goal.id,
      occurredAt: cycle.periodEnd ?? cycle.periodStart,
    },
    select: { id: true },
  });
  revalidateAppPages();
  return { transactionId: created.id };
});
