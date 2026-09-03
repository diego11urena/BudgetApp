"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  findCycleForDate,
  formatCycleRangeText,
  getOrCreateDraftCycle,
  getUserPayFrequency,
  linkOrCreateRecurringExpenseForTransaction,
  unlinkTransactionFromRecurringExpense,
} from "@/lib/cycles";
import { getOrCreateCategory } from "@/lib/categories";
import { revalidateAppPages } from "@/lib/revalidate";
import { addTransactionSchema, paymentMethodSchema, type AddTransactionInput } from "@/lib/validations/transactions";
import { decimalString, INVALID_AMOUNT_FORMAT_MESSAGE } from "@/lib/validations/shared";
import { nowInPanama, panamaDateParts, parseDateOnly, parseTransactionDate } from "@/lib/pay-date";
import { withActionErrorHandling, type ActionResult } from "@/lib/action-error";
import type { PaymentMethod } from "@/lib/payment-method";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary, resolveVocab } from "@/lib/i18n/get-dictionary";
import { translateValidationMessage } from "@/lib/i18n/translate-validation-message";
import type { Dictionary } from "@/lib/i18n/dictionary";

/**
 * Success carries the row's id — used by a "Logged · Undo" toast to delete
 * exactly that row. `message`, when set, is a non-error notice the caller
 * should still surface (e.g. updateTransactionAction silently unlinking a
 * recurring expense whose category no longer matches the edited row).
 */
export type TransactionMutationResult = ActionResult<{ transactionId: string; message?: string }> | undefined;

export interface DeletedTransactionSnapshot {
  cycleId: string;
  type: "EXPENSE" | "INCOME" | "SAVINGS";
  name: string;
  amount: number;
  occurredAt: string;
  paymentMethod: PaymentMethod | null;
  description: string | null;
  expenseCategoryId: string | null;
  recurringExpenseId: string | null;
  importSource: "MANUAL" | "GMAIL";
  sourceMessageId: string | null;
}

/** Success carries a snapshot of the deleted row so a "Deleted · Undo" toast can restore it. */
export type DeleteTransactionResult = ActionResult<{ deleted: DeletedTransactionSnapshot }> | undefined;

/**
 * The exact same addTransactionSchema.safeParse(formData) call, shared by
 * addTransactionAction and updateTransactionAction (create and edit submit
 * the identical set of fields) — everything after this point (cycle
 * resolution, date validation, the recurring-link transition) genuinely
 * diverges between the two and stays separate.
 */
function parseTransactionFields(formData: FormData, t: Dictionary): { error: string } | AddTransactionInput {
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
    return { error: translateValidationMessage(parsed.error.issues[0]?.message ?? "", t) || t.common.invalidInput };
  }
  return parsed.data;
}

export const addTransactionAction = withActionErrorHandling(async function addTransactionAction(
  _prevState: TransactionMutationResult,
  formData: FormData,
): Promise<TransactionMutationResult> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const t = getDictionary(await getRequestLocale());
  const vocab = resolveVocab(t, await getUserPayFrequency(userId));

  const parsed = parseTransactionFields(formData, t);
  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const { type, name, amount, category: categoryName, paymentMethod, occurredAt, description } = parsed;

  // A hinted cycleId (from a past-quincena's own "+" — see
  // /history/[cycleId]) means "add into this specific cycle" rather than
  // the current draft cycle. Ownership-checked: ownership on the current
  // draft cycle is implicit (getOrCreateDraftCycle only ever touches the
  // caller's own rows), but an arbitrary cycleId isn't.
  const hintedCycleId = formData.get("cycleId");
  const cycle =
    typeof hintedCycleId === "string" && hintedCycleId
      ? await prisma.budgetCycle.findFirst({ where: { id: hintedCycleId, userId } })
      : await getOrCreateDraftCycle(userId);
  if (!cycle) {
    return { error: t.dashboard.quincenaNotFound(vocab) };
  }

  let occurredAtDate = nowInPanama();
  if (occurredAt) {
    if (typeof hintedCycleId === "string" && hintedCycleId) {
      // Creating into a specific (possibly past) cycle: no cycle-start
      // floor, same relaxed rule updateTransactionAction already uses for
      // edits — the date, not the cycle you happened to be viewing, is
      // the source of truth for where this transaction actually belongs.
      const parsedDate = parseDateOnly(occurredAt);
      if (!parsedDate) {
        return { error: t.dashboard.editPayInfo.invalidDate };
      }
      if (parsedDate.getTime() > nowInPanama().getTime()) {
        return { error: t.quickAdd.dateNotFuture };
      }
      occurredAtDate = parsedDate;
    } else {
      const parsedDate = parseTransactionDate(occurredAt, cycle.periodStart);
      if (!parsedDate) {
        return { error: t.quickAdd.dateWithinQuincenaNotFuture(vocab) };
      }
      occurredAtDate = parsedDate;
    }
  }

  // When a specific cycle was hinted, the date just validated against may
  // not actually fall inside it (e.g. the user changed the date while
  // adding from a past quincena's page) — resolve the real owning cycle
  // from the date itself, same as updateTransactionAction does on edit.
  const targetCycleId =
    typeof hintedCycleId === "string" && hintedCycleId
      ? ((await findCycleForDate(userId, occurredAtDate))?.id ?? cycle.id)
      : cycle.id;

  // Every type has a category concept now — Extra income included.
  const category = await getOrCreateCategory(prisma, userId, categoryName ?? name, type);
  const expenseCategoryId = category.id;

  // EXPENSE-only, matching the toggle's own visibility (see QuickAddSheet) —
  // there's no recurring-expense concept for INCOME/SAVINGS.
  const wantsRecurring = type === "EXPENSE" && formData.get("recurring") === "true";

  const created = await prisma.$transaction(async (tx) => {
    const createdTx = await tx.cycleTransaction.create({
      data: {
        cycleId: targetCycleId,
        userId,
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

    if (wantsRecurring) {
      await linkOrCreateRecurringExpenseForTransaction(tx, {
        userId,
        transactionId: createdTx.id,
        categoryId: expenseCategoryId,
        cycleId: targetCycleId,
        name,
        amount,
      });
    }

    return createdTx;
  });

  revalidateAppPages();

  return { transactionId: created.id };
});

export const updateTransactionAction = withActionErrorHandling(async function updateTransactionAction(
  _prevState: TransactionMutationResult,
  formData: FormData,
): Promise<TransactionMutationResult> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const t = getDictionary(await getRequestLocale());

  const transactionId = formData.get("transactionId");
  if (typeof transactionId !== "string" || !transactionId) {
    return { error: t.quickAdd.missingTransaction };
  }

  const parsed = parseTransactionFields(formData, t);
  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const { type, name, amount, category: categoryName, paymentMethod, occurredAt, description } = parsed;

  // Ownership-scoped: a plain update({ where: { id } }) would let a user
  // edit another user's row by guessing an id.
  const existing = await prisma.cycleTransaction.findFirst({
    where: { id: transactionId, cycle: { userId } },
    include: { cycle: true, recurringExpense: true },
  });
  if (!existing) {
    return { error: t.quickAdd.transactionNotFound };
  }
  // Editing (unlike deleting) is always allowed, including on a closed
  // cycle's history — backfilling a payment method or fixing a category on
  // an old transaction is exactly what "frozen history" was never meant to
  // block. See deleteTransactionAction for why deletion stays restricted.

  // A savings withdrawal is stored as a real negative-amount SAVINGS
  // CycleTransaction (see goals/actions.ts's updateGoalWithContributionAction).
  // QuickAddSheet always shows/submits a plain positive number for amount
  // (Math.abs on load, same as every other transaction type), so the sign
  // has to be reapplied here from the row's OWN existing sign -- never
  // from anything the client sends. Reverts to positive if the type
  // changed away from SAVINGS mid-edit: "withdrawal" stops meaning
  // anything once it's no longer a savings row.
  const isWithdrawal = existing.type === "SAVINGS" && existing.amount.isNegative() && type === "SAVINGS";
  const signedAmount = isWithdrawal ? `-${amount}` : amount;

  // No cycle bound here (unlike addTransactionAction's create-time min) —
  // just "not in the future", since a transaction can't have happened yet.
  // A date is never required on edit; leaving it alone keeps the existing
  // value, matching how every other unset field on this form behaves.
  let occurredAtDate = existing.occurredAt;
  if (occurredAt) {
    const parsedDate = parseDateOnly(occurredAt);
    if (!parsedDate) {
      return { error: t.dashboard.editPayInfo.invalidDate };
    }
    const todayStart = nowInPanama();
    if (parsedDate.getTime() > todayStart.getTime()) {
      return { error: t.quickAdd.dateNotFuture };
    }
    // The date input has no time-of-day concept, so it always resubmits
    // the row's current day even when the user never touched this field
    // (e.g. only fixing the category or merchant name) -- parseDateOnly's
    // midnight anchor must only actually apply when the day itself
    // changed. Otherwise this would silently zero out a Gmail import's
    // real arrival time (or any other transaction's time-of-day) on every
    // unrelated edit.
    const existingDay = panamaDateParts(existing.occurredAt);
    const parsedDay = panamaDateParts(parsedDate);
    const dayChanged =
      existingDay.year !== parsedDay.year || existingDay.month !== parsedDay.month || existingDay.day !== parsedDay.day;
    if (dayChanged) {
      occurredAtDate = parsedDate;
    }
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

  // Only acts on an actual on/off TRANSITION, not "stays on" — re-running
  // the exact-match lookup on every save of an already-linked transaction
  // could surprise-relink it to a different recurring expense if the name
  // changed mid-edit. EXPENSE-only, matching the toggle's own visibility.
  const wasRecurring = existing.recurringExpenseId !== null;
  const wantsRecurring = type === "EXPENSE" && formData.get("recurring") === "true";
  // The toggle stayed on across this edit, but if the category also changed,
  // the linked RecurringExpense (defined under the OLD category) no longer
  // belongs to this transaction's new one — carrying the link forward would
  // let a transaction's recurringExpenseId and expenseCategoryId silently
  // disagree about which category this payment counts against. Unlink
  // rather than re-link to some same-named expense in the new category:
  // that's exactly the "same-moment user action" linkOrCreateRecurringExpenseForTransaction's
  // own doc comment says an automatic link should never guess at.
  const linkedToWrongCategory =
    wasRecurring && wantsRecurring && existing.recurringExpense!.categoryId !== expenseCategoryId;

  await prisma.$transaction(async (tx) => {
    // Updates the existing row in place — balances are always derived live
    // from CycleTransaction, so there's no separate total to reconcile and
    // no risk of double-counting.
    await tx.cycleTransaction.update({
      where: { id: transactionId },
      data: {
        cycleId: targetCycleId,
        type,
        name,
        amount: signedAmount,
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

    if (!wasRecurring && wantsRecurring) {
      await linkOrCreateRecurringExpenseForTransaction(tx, {
        userId,
        transactionId,
        categoryId: expenseCategoryId,
        cycleId: targetCycleId,
        name,
        amount,
      });
    } else if ((wasRecurring && !wantsRecurring) || linkedToWrongCategory) {
      await unlinkTransactionFromRecurringExpense(tx, {
        transactionId,
        cycleId: targetCycleId,
        categoryId: linkedToWrongCategory ? existing.recurringExpense!.categoryId : expenseCategoryId,
      });
    }
  });

  revalidateAppPages();

  return {
    transactionId,
    message: linkedToWrongCategory ? t.quickAdd.recurringLinkRemoved : undefined,
  };
});

/**
 * Lighter-weight sibling of updateTransactionAction for the "categorize
 * this import" flow (see dashboard's uncategorized-imports banner) — only
 * the category changes, so it skips re-validating type/name/amount and
 * doesn't require resubmitting them.
 */
export const categorizeTransactionAction = withActionErrorHandling(async function categorizeTransactionAction(
  formData: FormData,
): Promise<ActionResult<{ transactionId: string }>> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const t = getDictionary(await getRequestLocale());

  const transactionId = formData.get("transactionId");
  const categoryName = formData.get("category");
  if (typeof transactionId !== "string" || !transactionId) {
    return { error: t.quickAdd.missingTransaction };
  }
  if (typeof categoryName !== "string" || !categoryName.trim()) {
    return { error: t.quickAdd.categoryIsRequired };
  }

  // Ownership-scoped — see updateTransactionAction for why.
  const existing = await prisma.cycleTransaction.findFirst({
    where: { id: transactionId, cycle: { userId } },
    include: { cycle: true },
  });
  if (!existing) {
    return { error: t.quickAdd.transactionNotFound };
  }
  if (existing.cycle.status === "CLOSED") {
    return { error: t.quickAdd.quincenaClosedCantEdit(resolveVocab(t, await getUserPayFrequency(userId))) };
  }

  const category = await getOrCreateCategory(prisma, userId, categoryName.trim(), existing.type);

  // Same on/off-transition-only rule as updateTransactionAction — see its
  // comment. A transaction reaching this "categorize it" flow is very
  // unlikely to already be linked, but the check stays symmetric regardless.
  const wasRecurring = existing.recurringExpenseId !== null;
  const wantsRecurring =
    existing.type === "EXPENSE" && formData.get("recurring") === "true";

  await prisma.$transaction(async (tx) => {
    await tx.cycleTransaction.update({
      where: { id: transactionId },
      data: { expenseCategoryId: category.id },
    });

    if (!wasRecurring && wantsRecurring) {
      await linkOrCreateRecurringExpenseForTransaction(tx, {
        userId,
        transactionId,
        categoryId: category.id,
        cycleId: existing.cycleId,
        name: existing.name,
        amount: existing.amount,
      });
    } else if (wasRecurring && !wantsRecurring) {
      await unlinkTransactionFromRecurringExpense(tx, {
        transactionId,
        cycleId: existing.cycleId,
        categoryId: category.id,
      });
    }
  });

  revalidateAppPages();

  return { transactionId };
});

/**
 * Lighter-weight sibling of updateTransactionAction for the "describe this
 * Yappy transfer" flow (see dashboard's needs-description banner) — only
 * the description changes. Unlike categorizeTransactionAction, this isn't
 * blocked on a closed cycle: a Yappy transfer imported into a cycle that's
 * since closed still needs to be describable, same reasoning as
 * updateTransactionAction's own "editing history is always allowed" (see
 * its comment) — the description just wasn't known yet at import time.
 */
export const describeTransactionAction = withActionErrorHandling(async function describeTransactionAction(
  formData: FormData,
): Promise<ActionResult<{ transactionId: string }>> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const t = getDictionary(await getRequestLocale());

  const transactionId = formData.get("transactionId");
  const description = formData.get("description");
  if (typeof transactionId !== "string" || !transactionId) {
    return { error: t.quickAdd.missingTransaction };
  }
  if (typeof description !== "string" || !description.trim()) {
    return { error: t.dashboard.tellUsWhatItWasForError };
  }

  // Ownership-scoped — see updateTransactionAction for why.
  const existing = await prisma.cycleTransaction.findFirst({
    where: { id: transactionId, cycle: { userId } },
  });
  if (!existing) {
    return { error: t.quickAdd.transactionNotFound };
  }

  await prisma.cycleTransaction.update({
    where: { id: transactionId },
    data: { description: description.trim() },
  });

  revalidateAppPages();

  return { transactionId };
});

export const deleteTransactionAction = withActionErrorHandling(async function deleteTransactionAction(
  _prevState: DeleteTransactionResult,
  formData: FormData,
): Promise<DeleteTransactionResult> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const t = getDictionary(await getRequestLocale());

  const transactionId = formData.get("transactionId");
  if (typeof transactionId !== "string" || !transactionId) {
    return { error: t.quickAdd.missingTransaction };
  }

  // Ownership-scoped: a plain delete({ where: { id } }) would let a user
  // delete another user's row by guessing an id.
  const existing = await prisma.cycleTransaction.findFirst({
    where: { id: transactionId, cycle: { userId } },
  });
  if (!existing) {
    return { error: t.quickAdd.transactionNotFound };
  }
  // Deleting from a closed cycle is allowed, same as editing (see
  // updateTransactionAction) — a past quincena's transactions must stay
  // fully correctable, not just editable. Recoverable via the toast's Undo
  // (restoreTransactionAction), which already has no closed-cycle guard.

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
      expenseCategoryId: existing.expenseCategoryId,
      recurringExpenseId: existing.recurringExpenseId,
      importSource: existing.importSource,
      sourceMessageId: existing.sourceMessageId,
    },
  };
});

/**
 * Undo for a deleted transaction — recreates it with its original cycle,
 * fields, and timestamp so it reappears exactly where it was, including in
 * an already-closed cycle's history (frozen history is about not silently
 * rewriting totals elsewhere, not about blocking an explicit user undo).
 */
export const restoreTransactionAction = withActionErrorHandling(async function restoreTransactionAction(
  formData: FormData,
): Promise<ActionResult | undefined> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const t = getDictionary(await getRequestLocale());

  const cycleId = formData.get("cycleId");
  const type = formData.get("type");
  const name = formData.get("name");
  const amount = formData.get("amount");
  const occurredAt = formData.get("occurredAt");
  const rawPaymentMethod = formData.get("paymentMethod");
  const description = formData.get("description");
  const rawExpenseCategoryId = formData.get("expenseCategoryId");
  const rawRecurringExpenseId = formData.get("recurringExpenseId");
  const rawImportSource = formData.get("importSource");
  const rawSourceMessageId = formData.get("sourceMessageId");

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
    return { error: t.quickAdd.invalidUndoPayload };
  }
  // The rest of this action's inputs are trusted (validated at delete
  // time, ownership-checked below), but amount/occurredAt are a toast's
  // client-held snapshot resubmitted verbatim -- the same untrusted-input
  // boundary addTransactionAction's own schema already guards, so undo
  // can't hand Decimal(12,2) a value that overflows it, or `new Date()` a
  // string that silently produces an Invalid Date. occurredAt is a full
  // ISO timestamp (deleteTransactionAction's own toISOString() snapshot,
  // not a "YYYY-MM-DD"-only value), so this checks validity directly
  // rather than through parseDateOnly, which only accepts the latter.
  // decimalString itself has no sign in its regex -- deliberately, it's
  // the shared validator for every user-TYPED amount field, none of which
  // should ever accept a leading "-". A savings withdrawal's snapshot is
  // the one legitimate exception (deleteTransactionAction's own amount:
  // existing.amount.toNumber() carries its real negative sign through),
  // so the sign is stripped before validating the magnitude through the
  // same shared check, then reapplied after -- restoring a deleted
  // withdrawal via its toast's Undo has to bring its sign back with it,
  // not silently flip it into a positive contribution.
  const isNegative = amount.startsWith("-");
  const parsedAmount = decimalString.safeParse(isNegative ? amount.slice(1) : amount);
  if (!parsedAmount.success) {
    return {
      error: translateValidationMessage(
        parsedAmount.error.issues[0]?.message ?? INVALID_AMOUNT_FORMAT_MESSAGE,
        t,
      ),
    };
  }
  const signedAmount = isNegative ? `-${parsedAmount.data}` : parsedAmount.data;
  const parsedOccurredAt = new Date(occurredAt);
  if (Number.isNaN(parsedOccurredAt.getTime())) {
    return { error: t.dashboard.editPayInfo.invalidDate };
  }
  const paymentMethodParsed = paymentMethodSchema.safeParse(rawPaymentMethod);
  const paymentMethod = paymentMethodParsed.success ? paymentMethodParsed.data : null;
  const expenseCategoryId = typeof rawExpenseCategoryId === "string" && rawExpenseCategoryId ? rawExpenseCategoryId : null;
  const recurringExpenseId = typeof rawRecurringExpenseId === "string" && rawRecurringExpenseId ? rawRecurringExpenseId : null;
  const importSource = rawImportSource === "GMAIL" ? "GMAIL" : "MANUAL";
  const sourceMessageId = typeof rawSourceMessageId === "string" && rawSourceMessageId ? rawSourceMessageId : null;

  // Ownership-scoped: only restore into a cycle that belongs to this user.
  const cycle = await prisma.budgetCycle.findFirst({ where: { id: cycleId, userId } });
  if (!cycle) {
    return { error: t.quickAdd.restoreCycleNotFound };
  }

  // Restores the exact category/recurring-expense link the deleted row had
  // (deleteTransactionAction's snapshot carries the real ids now), not a
  // name-based re-lookup — re-resolving by name could land on a different
  // category than the one this transaction actually belonged to (e.g. two
  // categories that happen to share a name after a rename), and would
  // silently drop the recurring-expense link and Gmail-import identity
  // entirely.
  await prisma.cycleTransaction.create({
    data: {
      cycleId,
      userId,
      type,
      name,
      amount: signedAmount,
      expenseCategoryId,
      recurringExpenseId,
      importSource,
      sourceMessageId,
      paymentMethod: type !== "SAVINGS" ? paymentMethod : null,
      description: typeof description === "string" && description ? description : null,
      occurredAt: parsedOccurredAt,
    },
  });

  revalidateAppPages();
});

export interface CyclePreview {
  cycleId: string;
  label: string;
  rangeText: string;
}

/**
 * Read-only: which cycle a candidate date actually belongs to, for
 * QuickAddSheet's cross-cycle move confirmation — wraps the exact same
 * findCycleForDate call updateTransactionAction/addTransactionAction use to
 * do the real reassignment, so the confirmation preview can never disagree
 * with what actually happens on submit.
 */
export const resolveCycleForDateAction = withActionErrorHandling(async function resolveCycleForDateAction(
  dateStr: string,
): Promise<CyclePreview | null> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const date = parseDateOnly(dateStr);
  if (!date) return null;

  const cycle = await findCycleForDate(userId, date);
  if (!cycle) return null;

  const payFrequency = await getUserPayFrequency(userId);
  return { cycleId: cycle.id, label: cycle.label, rangeText: formatCycleRangeText(cycle, {}, payFrequency) };
});
