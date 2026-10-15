"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  assessPayDateChange,
  closeCycleAndStartNext,
  deleteCycleIncomeEntry,
  getActiveIncomeSource,
  getOrCreateDraftCycle,
  getUserBudgetFrequency,
  logPaycheckToOpenCycle,
  parsePayDate,
  updateCycleIncomeEntry,
  upsertCycleIncomeEntry,
  type PayDateChangeResult,
} from "@/lib/cycles";
import { formatCycleLabel, nowInPanama, parseDateOnly } from "@/lib/pay-date";
import { decimalString, INVALID_AMOUNT_FORMAT_MESSAGE } from "@/lib/validations/shared";
import { revalidateAppPages } from "@/lib/revalidate";
import { withActionErrorHandling, type ActionResult } from "@/lib/action-error";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary, resolveVocab } from "@/lib/i18n/get-dictionary";
import { translateValidationMessage } from "@/lib/i18n/translate-validation-message";

const JUST_GOT_PAID_RATE_LIMIT = { max: 10, windowMs: 60_000 };
const ROLLOVER_MONTH_RATE_LIMIT = { max: 10, windowMs: 60_000 };
const LOG_PAYCHECK_RATE_LIMIT = { max: 10, windowMs: 60_000 };

/** Not a form submission (no _prevState/useActionState here) — the caller (HeroCardActions) checks `"error" in result` directly, then routes to /dashboard/summary/{closedCycleId}. */
export type CycleClosedResult = ActionResult<{ closedCycleId: string }>;

/**
 * payDateStr is the "When did you get paid?" date input's value
 * ("YYYY-MM-DD"). An invalid/out-of-range value (the field's own min/max
 * already constrain this client-side; this is the server-side backstop)
 * falls back to today rather than failing the whole close-cycle action.
 */
export const justGotPaidAction = withActionErrorHandling(async function justGotPaidAction(
  payDateStr?: string,
): Promise<CycleClosedResult> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const t = getDictionary(await getRequestLocale());

  // Closing a cycle in a loop would grow BudgetCycle without bound --
  // this is the one throttle standing between a scripted/compromised
  // session and that.
  const rateLimit = await checkRateLimit(`just-got-paid:${session.user.id}`, JUST_GOT_PAID_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return { error: t.common.tooManyAttempts(rateLimit.retryAfterSeconds) };
  }

  const payDate = (payDateStr && parsePayDate(payDateStr)) || nowInPanama();

  const { closedCycle } = await closeCycleAndStartNext(session.user.id, payDate);

  revalidateAppPages();

  return { closedCycleId: closedCycle.id };
});

/**
 * MONTHLY-budget only: "Close this month" -- closes the current cycle and
 * starts the next, via the same closeCycleAndStartNext justGotPaidAction
 * uses, but with carryIncomeForward: false (a fresh MONTHLY cycle starts
 * at $0 income -- individual paychecks get logged into it via
 * logPaycheckAction instead of being seeded from a guess) and never
 * prompts to confirm a paycheck amount afterward.
 */
export const rolloverMonthlyCycleAction = withActionErrorHandling(async function rolloverMonthlyCycleAction(
  payDateStr?: string,
): Promise<CycleClosedResult> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const t = getDictionary(await getRequestLocale());

  const rateLimit = await checkRateLimit(`rollover-month:${session.user.id}`, ROLLOVER_MONTH_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return { error: t.common.tooManyAttempts(rateLimit.retryAfterSeconds) };
  }

  const payDate = (payDateStr && parsePayDate(payDateStr)) || nowInPanama();

  const { closedCycle } = await closeCycleAndStartNext(session.user.id, payDate, {
    carryIncomeForward: false,
  });

  revalidateAppPages();

  return { closedCycleId: closedCycle.id };
});

export type LogPaycheckResult = ActionResult | undefined;

/**
 * MONTHLY-budget only: logs one paycheck into the currently open cycle
 * additively (see lib/cycles.ts's logPaycheckToOpenCycle) -- never closes
 * or starts a new cycle, unlike justGotPaidAction/rolloverMonthlyCycleAction.
 * This is the mechanism that lets a twice-monthly or biweekly paycheck
 * accumulate into one MONTHLY budget cycle instead of resetting it.
 */
export const logPaycheckAction = withActionErrorHandling(async function logPaycheckAction(
  formData: FormData,
): Promise<LogPaycheckResult> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const t = getDictionary(await getRequestLocale());

  const rateLimit = await checkRateLimit(`log-paycheck:${userId}`, LOG_PAYCHECK_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return { error: t.common.tooManyAttempts(rateLimit.retryAfterSeconds) };
  }

  const parsedAmount = decimalString.safeParse(formData.get("netPayAmount"));
  if (!parsedAmount.success) {
    return { error: translateValidationMessage(parsedAmount.error.issues[0]?.message ?? INVALID_AMOUNT_FORMAT_MESSAGE, t) };
  }

  const payDateStr = formData.get("payDate");
  if (typeof payDateStr !== "string" || !payDateStr) {
    return { error: t.dashboard.editPayInfo.dateRequired };
  }
  const payDate = parseDateOnly(payDateStr);
  if (!payDate) {
    return { error: t.dashboard.editPayInfo.invalidDate };
  }

  const incomeSource = await getActiveIncomeSource(prisma, userId);
  if (!incomeSource) {
    return { error: t.dashboard.noIncomeSource };
  }

  await logPaycheckToOpenCycle(userId, parsedAmount.data, payDate);

  revalidateAppPages();
});

export type EditPayInfoResult = ActionResult | undefined;

/**
 * "Edit" on the Home hero card, and (via an explicit cycleId in formData)
 * the same "Edit" trigger on a past cycle's own page — corrects a cycle's
 * already-recorded pay amount and/or pay date in place, as opposed to "I
 * just got paid" which always closes the cycle and starts a new one.
 *
 * A pay-date change is bounded by this cycle's actual neighbors (via
 * assessPayDateChange) and reassigns whichever transactions now fall on
 * the other side of the shifted boundary — the same for the current draft
 * cycle as for a closed one, via the exact same assessPayDateChange the
 * preview action already showed the user (see previewPayDateChangeAction),
 * so what gets reassigned can never disagree with what the confirmation
 * said would happen. The draft cycle has no "next" neighbor to bound it
 * (nothing exists after it yet), so it additionally can't be moved into
 * the future.
 *
 * On the current draft cycle (no cycleId, or cycleId resolving to it):
 * also updates IncomeSource.netPayAmount, so the correction becomes
 * the new baseline for future cycles. On a CLOSED cycle, that baseline is
 * left alone — only the currently-open cycle's edits should change what
 * prefills the *next* cycle's income prompt.
 */
export const editCyclePayInfoAction = withActionErrorHandling(async function editCyclePayInfoAction(
  formData: FormData,
): Promise<EditPayInfoResult> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const t = getDictionary(await getRequestLocale());

  const parsedAmount = decimalString.safeParse(formData.get("netPayAmount"));
  if (!parsedAmount.success) {
    return { error: translateValidationMessage(parsedAmount.error.issues[0]?.message ?? INVALID_AMOUNT_FORMAT_MESSAGE, t) };
  }

  const payDateStr = formData.get("payDate");
  if (typeof payDateStr !== "string" || !payDateStr) {
    return { error: t.dashboard.editPayInfo.dateRequired };
  }
  const payDate = parseDateOnly(payDateStr);
  if (!payDate) {
    return { error: t.dashboard.editPayInfo.invalidDate };
  }

  const hintedCycleId = formData.get("cycleId");
  const cycle =
    typeof hintedCycleId === "string" && hintedCycleId
      ? await prisma.budgetCycle.findFirst({ where: { id: hintedCycleId, userId } })
      : await getOrCreateDraftCycle(userId);
  if (!cycle) {
    return { error: t.dashboard.quincenaNotFound(resolveVocab(t, await getUserBudgetFrequency(userId))) };
  }

  let assessment: PayDateChangeResult | null = null;
  const payDateChanging = payDate.getTime() !== cycle.periodStart.getTime();

  if (payDateChanging) {
    if (cycle.status !== "CLOSED" && payDate.getTime() > nowInPanama().getTime()) {
      return { error: t.dashboard.editPayInfo.dateNotFuture };
    }
    assessment = await assessPayDateChange(userId, cycle, payDate, t.dashboard.editPayInfo);
    if (!assessment.ok) {
      return { error: assessment.error };
    }
  }

  const incomeSource = await getActiveIncomeSource(prisma, userId);
  if (!incomeSource) {
    return { error: t.dashboard.noIncomeSource };
  }

  await prisma.$transaction(async (tx) => {
    if (cycle.status !== "CLOSED") {
      await tx.incomeSource.update({
        where: { id: incomeSource.id },
        data: { netPayAmount: parsedAmount.data },
      });
    }
    await upsertCycleIncomeEntry(tx, cycle.id, incomeSource.id, parsedAmount.data);
    await tx.budgetCycle.update({
      where: { id: cycle.id },
      data: { periodStart: payDate, label: formatCycleLabel(payDate) },
    });

    if (assessment?.ok && assessment.changed && assessment.movingCount > 0 && assessment.moveRange) {
      const sourceForMoved = assessment.direction === "in" ? assessment.otherCycleId! : cycle.id;
      const targetForMoved = assessment.direction === "in" ? cycle.id : assessment.otherCycleId!;
      await tx.cycleTransaction.updateMany({
        where: { cycleId: sourceForMoved, occurredAt: assessment.moveRange },
        data: { cycleId: targetForMoved },
      });
    }
  });

  revalidateAppPages();
});

/**
 * Read-only preview for a past cycle's pay-date edit — how many
 * transactions would move, and which quincena they'd move to/from, before
 * the user confirms. Shares assessPayDateChange with the actual commit
 * (editCyclePayInfoAction) so this can never show a different outcome than
 * what saving actually does.
 */
export const previewPayDateChangeAction = withActionErrorHandling(async function previewPayDateChangeAction(
  cycleId: string,
  newPayDateStr: string,
): Promise<PayDateChangeResult> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const t = getDictionary(await getRequestLocale());

  const cycle = await prisma.budgetCycle.findFirst({ where: { id: cycleId, userId } });
  if (!cycle) {
    return { ok: false, error: t.dashboard.quincenaNotFound(resolveVocab(t, await getUserBudgetFrequency(userId))) };
  }
  const newDate = parseDateOnly(newPayDateStr);
  if (!newDate) {
    return { ok: false, error: t.dashboard.editPayInfo.invalidDate };
  }

  return assessPayDateChange(userId, cycle, newDate, t.dashboard.editPayInfo);
});

export type UpdateCycleIncomeEntryResult = ActionResult | undefined;

/**
 * MONTHLY-budget only: corrects one already-logged paycheck's amount
 * and/or date in place (MonthlyIncomeEntriesSheet's per-row edit) --
 * unlike editCyclePayInfoAction, this never reassigns cycle membership or
 * moves any transaction, since a CycleIncomeEntry's receivedAt is display
 * metadata only (see updateCycleIncomeEntry's own doc comment).
 */
export const updateCycleIncomeEntryAction = withActionErrorHandling(async function updateCycleIncomeEntryAction(
  formData: FormData,
): Promise<UpdateCycleIncomeEntryResult> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const t = getDictionary(await getRequestLocale());

  const entryId = formData.get("entryId");
  if (typeof entryId !== "string" || !entryId) {
    return { error: t.common.invalidInput };
  }

  const parsedAmount = decimalString.safeParse(formData.get("netPayAmount"));
  if (!parsedAmount.success) {
    return { error: translateValidationMessage(parsedAmount.error.issues[0]?.message ?? INVALID_AMOUNT_FORMAT_MESSAGE, t) };
  }

  const payDateStr = formData.get("payDate");
  if (typeof payDateStr !== "string" || !payDateStr) {
    return { error: t.dashboard.editPayInfo.dateRequired };
  }
  const payDate = parseDateOnly(payDateStr);
  if (!payDate) {
    return { error: t.dashboard.editPayInfo.invalidDate };
  }

  // entryId alone doesn't prove ownership -- scope the lookup through the
  // owning cycle's userId before writing anything.
  const entry = await prisma.cycleIncomeEntry.findFirst({ where: { id: entryId, cycle: { userId } } });
  if (!entry) {
    return { error: t.common.invalidInput };
  }

  await updateCycleIncomeEntry(prisma, entryId, parsedAmount.data, payDate);

  revalidateAppPages();
});

export type DeleteCycleIncomeEntryResult = ActionResult | undefined;

/** MONTHLY-budget only: removes one logged paycheck entirely (MonthlyIncomeEntriesSheet's per-row delete) -- e.g. a duplicate log or a mistaken entry. */
export const deleteCycleIncomeEntryAction = withActionErrorHandling(async function deleteCycleIncomeEntryAction(
  entryId: string,
): Promise<DeleteCycleIncomeEntryResult> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const t = getDictionary(await getRequestLocale());

  const entry = await prisma.cycleIncomeEntry.findFirst({ where: { id: entryId, cycle: { userId } } });
  if (!entry) {
    return { error: t.common.invalidInput };
  }

  await deleteCycleIncomeEntry(prisma, entryId);

  revalidateAppPages();
});
