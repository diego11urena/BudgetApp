"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import { getOrCreateCategory } from "@/lib/categories";
import { revalidateAppPages } from "@/lib/revalidate";
import { addTransactionSchema } from "@/lib/validations/transactions";

/** Success carries the row's id — used by a "Logged · Undo" toast to delete exactly that row. */
export type TransactionMutationResult = { error: string } | { transactionId: string } | undefined;

export interface DeletedTransactionSnapshot {
  cycleId: string;
  type: "EXPENSE" | "INCOME" | "SAVINGS";
  name: string;
  amount: number;
  occurredAt: string;
}

/** Success carries a snapshot of the deleted row so a "Deleted · Undo" toast can restore it. */
export type DeleteTransactionResult =
  | { error: string }
  | { deleted: DeletedTransactionSnapshot }
  | undefined;

export async function addTransactionAction(
  _prevState: TransactionMutationResult,
  formData: FormData,
): Promise<TransactionMutationResult> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const parsed = addTransactionSchema.safeParse({
    type: formData.get("type"),
    name: formData.get("name"),
    amount: formData.get("amount"),
    category: formData.get("category") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { type, name, amount, category: categoryName } = parsed.data;
  const cycle = await getOrCreateDraftCycle(userId);

  let expenseCategoryId: string | null = null;
  if (type !== "INCOME") {
    const category = await getOrCreateCategory(prisma, userId, categoryName ?? name, type);
    expenseCategoryId = category.id;
  }

  const created = await prisma.cycleTransaction.create({
    data: { cycleId: cycle.id, type, name, amount, expenseCategoryId },
    select: { id: true },
  });

  revalidateAppPages();

  return { transactionId: created.id };
}

export async function updateTransactionAction(
  _prevState: TransactionMutationResult,
  formData: FormData,
): Promise<TransactionMutationResult> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const transactionId = formData.get("transactionId");
  if (typeof transactionId !== "string" || !transactionId) {
    return { error: "Missing transaction" };
  }

  const parsed = addTransactionSchema.safeParse({
    type: formData.get("type"),
    name: formData.get("name"),
    amount: formData.get("amount"),
    category: formData.get("category") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { type, name, amount, category: categoryName } = parsed.data;

  // Ownership-scoped: a plain update({ where: { id } }) would let a user
  // edit another user's row by guessing an id.
  const existing = await prisma.cycleTransaction.findFirst({
    where: { id: transactionId, cycle: { userId } },
    include: { cycle: true },
  });
  if (!existing) {
    return { error: "Transaction not found" };
  }
  // Frozen history: once a quincena is closed, its totals shouldn't move.
  // The UI already keeps closed-cycle rows from opening this action's
  // sheet at all (TransactionList) — this is the server-side backstop.
  if (existing.cycle.status === "CLOSED") {
    return { error: "This quincena is closed and can't be edited" };
  }

  let expenseCategoryId: string | null = null;
  if (type !== "INCOME") {
    const category = await getOrCreateCategory(prisma, userId, categoryName ?? name, type);
    expenseCategoryId = category.id;
  }

  // Updates the existing row in place — balances are always derived live
  // from CycleTransaction, so there's no separate total to reconcile and
  // no risk of double-counting.
  await prisma.cycleTransaction.update({
    where: { id: transactionId },
    data: { type, name, amount, expenseCategoryId },
  });

  revalidateAppPages();

  return { transactionId };
}

/**
 * Lighter-weight sibling of updateTransactionAction for the "categorize
 * this import" flow (see dashboard's uncategorized-imports banner) — only
 * the category changes, so it skips re-validating type/name/amount and
 * doesn't require resubmitting them.
 */
export async function categorizeTransactionAction(
  formData: FormData,
): Promise<{ error: string } | { transactionId: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const transactionId = formData.get("transactionId");
  const categoryName = formData.get("category");
  if (typeof transactionId !== "string" || !transactionId) {
    return { error: "Missing transaction" };
  }
  if (typeof categoryName !== "string" || !categoryName.trim()) {
    return { error: "Category is required" };
  }

  // Ownership-scoped — see updateTransactionAction for why.
  const existing = await prisma.cycleTransaction.findFirst({
    where: { id: transactionId, cycle: { userId } },
    include: { cycle: true },
  });
  if (!existing) {
    return { error: "Transaction not found" };
  }
  if (existing.cycle.status === "CLOSED") {
    return { error: "This quincena is closed and can't be edited" };
  }
  if (existing.type === "INCOME") {
    return { error: "Income transactions don't have a category" };
  }

  const category = await getOrCreateCategory(prisma, userId, categoryName.trim(), existing.type);

  await prisma.cycleTransaction.update({
    where: { id: transactionId },
    data: { expenseCategoryId: category.id },
  });

  revalidateAppPages();

  return { transactionId };
}

export async function deleteTransactionAction(
  _prevState: DeleteTransactionResult,
  formData: FormData,
): Promise<DeleteTransactionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const transactionId = formData.get("transactionId");
  if (typeof transactionId !== "string" || !transactionId) {
    return { error: "Missing transaction" };
  }

  // Ownership-scoped: a plain delete({ where: { id } }) would let a user
  // delete another user's row by guessing an id.
  const existing = await prisma.cycleTransaction.findFirst({
    where: { id: transactionId, cycle: { userId } },
    include: { cycle: true },
  });
  if (!existing) {
    return { error: "Transaction not found" };
  }
  // Frozen history — see the matching check in updateTransactionAction.
  if (existing.cycle.status === "CLOSED") {
    return { error: "This quincena is closed and can't be edited" };
  }

  await prisma.cycleTransaction.delete({ where: { id: transactionId } });

  revalidateAppPages();

  return {
    deleted: {
      cycleId: existing.cycleId,
      type: existing.type,
      name: existing.name,
      amount: existing.amount.toNumber(),
      occurredAt: existing.occurredAt.toISOString(),
    },
  };
}

/**
 * Undo for a deleted transaction — recreates it with its original cycle,
 * fields, and timestamp so it reappears exactly where it was, including in
 * an already-closed cycle's history (frozen history is about not silently
 * rewriting totals elsewhere, not about blocking an explicit user undo).
 */
export async function restoreTransactionAction(
  formData: FormData,
): Promise<{ error?: string } | undefined> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const cycleId = formData.get("cycleId");
  const type = formData.get("type");
  const name = formData.get("name");
  const amount = formData.get("amount");
  const occurredAt = formData.get("occurredAt");

  if (
    typeof cycleId !== "string" ||
    !cycleId ||
    typeof name !== "string" ||
    !name ||
    typeof amount !== "string" ||
    !amount ||
    typeof occurredAt !== "string" ||
    !occurredAt ||
    (type !== "EXPENSE" && type !== "INCOME" && type !== "SAVINGS")
  ) {
    return { error: "Invalid undo payload" };
  }

  // Ownership-scoped: only restore into a cycle that belongs to this user.
  const cycle = await prisma.budgetCycle.findFirst({ where: { id: cycleId, userId } });
  if (!cycle) {
    return { error: "Cycle not found" };
  }

  let expenseCategoryId: string | null = null;
  if (type !== "INCOME") {
    const category = await getOrCreateCategory(prisma, userId, name, type);
    expenseCategoryId = category.id;
  }

  await prisma.cycleTransaction.create({
    data: { cycleId, type, name, amount, expenseCategoryId, occurredAt: new Date(occurredAt) },
  });

  revalidateAppPages();
}
