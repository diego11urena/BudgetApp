"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findCycleForDate, getOrCreateDraftCycle } from "@/lib/cycles";
import { getOrCreateCategory } from "@/lib/categories";
import { revalidateAppPages } from "@/lib/revalidate";
import { addTransactionSchema, paymentMethodSchema } from "@/lib/validations/transactions";
import { parseDateOnly, parseTransactionDate } from "@/lib/pay-date";

/** Success carries the row's id — used by a "Logged · Undo" toast to delete exactly that row. */
export type TransactionMutationResult = { error: string } | { transactionId: string } | undefined;

export interface DeletedTransactionSnapshot {
  cycleId: string;
  type: "EXPENSE" | "INCOME" | "SAVINGS";
  name: string;
  amount: number;
  occurredAt: string;
  paymentMethod: "CASH" | "CREDIT_CARD" | "DEBIT_CARD" | "YAPPY" | "ACH" | null;
  description: string | null;
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
    paymentMethod: formData.get("paymentMethod") ?? undefined,
    occurredAt: formData.get("occurredAt") || undefined,
    description: formData.get("description") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { type, name, amount, category: categoryName, paymentMethod, occurredAt, description } =
    parsed.data;
  const cycle = await getOrCreateDraftCycle(userId);

  let occurredAtDate = new Date();
  if (occurredAt) {
    const parsedDate = parseTransactionDate(occurredAt, cycle.periodStart);
    if (!parsedDate) {
      return { error: "Date must be within this quincena and not in the future" };
    }
    occurredAtDate = parsedDate;
  }

  // Every type has a category concept now — Extra income included.
  const category = await getOrCreateCategory(prisma, userId, categoryName ?? name, type);
  const expenseCategoryId = category.id;

  const created = await prisma.cycleTransaction.create({
    data: {
      cycleId: cycle.id,
      type,
      name,
      amount,
      expenseCategoryId,
      // SAVINGS-only exclusion (not EXPENSE-only) — a payment method is
      // meaningful for money going out (EXPENSE) and, since Yappy/ACH are
      // rails that work either direction, money coming in (INCOME) too. A
      // savings contribution has never had this concept and still doesn't.
      paymentMethod: type !== "SAVINGS" ? (paymentMethod ?? null) : null,
      description: description ?? null,
      occurredAt: occurredAtDate,
    },
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
    paymentMethod: formData.get("paymentMethod") ?? undefined,
    occurredAt: formData.get("occurredAt") || undefined,
    description: formData.get("description") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { type, name, amount, category: categoryName, paymentMethod, occurredAt, description } =
    parsed.data;

  // Ownership-scoped: a plain update({ where: { id } }) would let a user
  // edit another user's row by guessing an id.
  const existing = await prisma.cycleTransaction.findFirst({
    where: { id: transactionId, cycle: { userId } },
    include: { cycle: true },
  });
  if (!existing) {
    return { error: "Transaction not found" };
  }
  // Editing (unlike deleting) is always allowed, including on a closed
  // cycle's history — backfilling a payment method or fixing a category on
  // an old transaction is exactly what "frozen history" was never meant to
  // block. See deleteTransactionAction for why deletion stays restricted.

  // No cycle bound here (unlike addTransactionAction's create-time min) —
  // just "not in the future", since a transaction can't have happened yet.
  // A date is never required on edit; leaving it alone keeps the existing
  // value, matching how every other unset field on this form behaves.
  let occurredAtDate = existing.occurredAt;
  if (occurredAt) {
    const parsedDate = parseDateOnly(occurredAt);
    if (!parsedDate) {
      return { error: "Invalid date" };
    }
    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (parsedDate.getTime() > todayStart.getTime()) {
      return { error: "Date can't be in the future" };
    }
    occurredAtDate = parsedDate;
  }

  // The transaction moves to whichever cycle actually covers its (possibly
  // just-edited, possibly already-mismatched from an earlier pay-date edit)
  // date — cycle membership was always this transaction's cycleId, never a
  // date-range computation, so an edited date has to explicitly carry it
  // over instead of just silently disagreeing with its own cycle.
  const correctCycle = await findCycleForDate(userId, occurredAtDate);
  const targetCycleId = correctCycle?.id ?? existing.cycleId;

  // Every type has a category concept now — Extra income included.
  const category = await getOrCreateCategory(prisma, userId, categoryName ?? name, type);
  const expenseCategoryId = category.id;

  // Updates the existing row in place — balances are always derived live
  // from CycleTransaction, so there's no separate total to reconcile and
  // no risk of double-counting.
  await prisma.cycleTransaction.update({
    where: { id: transactionId },
    data: {
      cycleId: targetCycleId,
      type,
      name,
      amount,
      expenseCategoryId,
      // SAVINGS-only exclusion (not EXPENSE-only) — a payment method is
      // meaningful for money going out (EXPENSE) and, since Yappy/ACH are
      // rails that work either direction, money coming in (INCOME) too. A
      // savings contribution has never had this concept and still doesn't.
      paymentMethod: type !== "SAVINGS" ? (paymentMethod ?? null) : null,
      // Blank on the form means "leave alone" (same convention as
      // occurredAt above), not "clear" — there's no dedicated affordance to
      // erase an already-set description, matching every other optional
      // field on this sheet.
      description: description ?? existing.description,
      occurredAt: occurredAtDate,
    },
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

  const category = await getOrCreateCategory(prisma, userId, categoryName.trim(), existing.type);

  await prisma.cycleTransaction.update({
    where: { id: transactionId },
    data: { expenseCategoryId: category.id },
  });

  revalidateAppPages();

  return { transactionId };
}

/**
 * Lighter-weight sibling of updateTransactionAction for the "describe this
 * Yappy transfer" flow (see dashboard's needs-description banner) — only
 * the description changes. Unlike categorizeTransactionAction, this isn't
 * blocked on a closed cycle: a Yappy transfer imported into a cycle that's
 * since closed still needs to be describable, same reasoning as
 * updateTransactionAction's own "editing history is always allowed" (see
 * its comment) — the description just wasn't known yet at import time.
 */
export async function describeTransactionAction(
  formData: FormData,
): Promise<{ error: string } | { transactionId: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const transactionId = formData.get("transactionId");
  const description = formData.get("description");
  if (typeof transactionId !== "string" || !transactionId) {
    return { error: "Missing transaction" };
  }
  if (typeof description !== "string" || !description.trim()) {
    return { error: "Tell us what it was for" };
  }

  // Ownership-scoped — see updateTransactionAction for why.
  const existing = await prisma.cycleTransaction.findFirst({
    where: { id: transactionId, cycle: { userId } },
  });
  if (!existing) {
    return { error: "Transaction not found" };
  }

  await prisma.cycleTransaction.update({
    where: { id: transactionId },
    data: { description: description.trim() },
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
      paymentMethod: existing.paymentMethod,
      description: existing.description,
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
  const rawPaymentMethod = formData.get("paymentMethod");
  const description = formData.get("description");

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
  const paymentMethodParsed = paymentMethodSchema.safeParse(rawPaymentMethod);
  const paymentMethod = paymentMethodParsed.success ? paymentMethodParsed.data : null;

  // Ownership-scoped: only restore into a cycle that belongs to this user.
  const cycle = await prisma.budgetCycle.findFirst({ where: { id: cycleId, userId } });
  if (!cycle) {
    return { error: "Cycle not found" };
  }

  // Every type has a category concept now — Extra income included. The
  // snapshot never captured a separate category name (only Gmail imports
  // ever have one distinct from their name, and imports aren't
  // user-deletable via this flow the same way), so this always matches
  // create/update's own categoryName-falls-back-to-name behavior.
  const category = await getOrCreateCategory(prisma, userId, name, type);
  const expenseCategoryId = category.id;

  await prisma.cycleTransaction.create({
    data: {
      cycleId,
      type,
      name,
      amount,
      expenseCategoryId,
      paymentMethod: type !== "SAVINGS" ? paymentMethod : null,
      description: typeof description === "string" && description ? description : null,
      occurredAt: new Date(occurredAt),
    },
  });

  revalidateAppPages();
}
