"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  assessPayDateChange,
  closeCycleAndStartNext,
  getActiveIncomeSource,
  getOrCreateDraftCycle,
  getRecentCycles,
  getUserPayFrequency,
  parsePayDate,
  upsertCycleIncomeEntry,
  type PayDateChangeResult,
} from "@/lib/cycles";
import type { Prisma } from "@/app/generated/prisma/client";
import { formatCycleLabel, nowInPanama, parseDateOnly } from "@/lib/pay-date";
import { getRecurringExpensesForCycle, summarizeRecurringExpenses } from "@/lib/recurring-expenses";
import { summarizeCycleFinancials } from "@/lib/cycle-financials";
import { computeStreak } from "@/lib/insights";
import { getBudgetUsage } from "@/lib/budget-status";
import { decimalString, INVALID_AMOUNT_FORMAT_MESSAGE } from "@/lib/validations/shared";
import { revalidateAppPages } from "@/lib/revalidate";
import { withActionErrorHandling, type ActionResult } from "@/lib/action-error";
import { checkRateLimit } from "@/lib/rate-limit";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary, resolveVocab } from "@/lib/i18n/get-dictionary";
import { translateValidationMessage } from "@/lib/i18n/translate-validation-message";

const JUST_GOT_PAID_RATE_LIMIT = { max: 10, windowMs: 60_000 };

export interface CycleClosedSummary {
  spent: number;
  saved: number;
  /** Income minus expenses minus savings — what's left from that quincena. */
  rolledOver: number;
  topCategory: { name: string; icon: string | null; amount: number } | null;
  budget: { hasBudget: boolean; overBy: number };
  /** The amount auto-carried into the new cycle — prefills the "how much did you get paid?" prompt. */
  carriedIncomeAmount: number;
  /** Consecutive closed cycles (including the one that just closed) finishing with amountLeft >= 0 -- see computeStreak. Rendered on CycleClosedCard, not Insights: a streak is won right at the moment a cycle closes, which is this exact response. */
  streak: number;
}

/** Not a form submission (no _prevState/useActionState here) — the caller (HeroCard) checks `"error" in result` directly instead of going through useActionState. */
export type CycleClosedResult = ActionResult<CycleClosedSummary>;

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

  const { closedCycle, newCycle, closedCycleFinancials } = await closeCycleAndStartNext(
    session.user.id,
    payDate,
  );
  const [recurringExpenseCategories, carriedEntry, recentCycles] = await Promise.all([
    getRecurringExpensesForCycle(session.user.id, closedCycle.id, { computeSuggestions: false }),
    prisma.cycleIncomeEntry.findFirst({ where: { cycleId: newCycle.id } }),
    // For the streak below -- previously-closed cycles, oldest boundary
    // first, same newest-first order computeStreak (and Insights' own
    // category-anomaly rule) already expects.
    getRecentCycles(session.user.id),
  ]);
  const recurringExpensesSummary = summarizeRecurringExpenses(recurringExpenseCategories);
  const top = closedCycleFinancials.topCategories[0];

  // The cycle that just closed counts as the most recent point in its own
  // streak -- getRecentCycles was fetched after closeCycleAndStartNext
  // committed, so it already includes closedCycle (now CLOSED) alongside
  // whatever closed cycles came before it; excluding closedCycle.id here
  // avoids counting it twice against closedCycleFinancials.
  const olderClosedFinancials = recentCycles
    .filter((c) => c.status === "CLOSED" && c.id !== closedCycle.id)
    .map((c) => summarizeCycleFinancials(c.incomeEntries, c.transactions));
  const streak = computeStreak([closedCycleFinancials, ...olderClosedFinancials]);

  revalidateAppPages();

  return {
    spent: closedCycleFinancials.totalExpenses,
    saved: closedCycleFinancials.totalSavings,
    rolledOver: closedCycleFinancials.amountLeft,
    topCategory: top ? { name: top.categoryName, icon: top.categoryIcon, amount: top.amount } : null,
    streak,
    budget: {
      hasBudget: recurringExpensesSummary.totalCount > 0,
      overBy: getBudgetUsage(recurringExpensesSummary.totalActual, recurringExpensesSummary.totalTarget).overBy,
    },
    carriedIncomeAmount: carriedEntry?.netAmount.toNumber() ?? 0,
  };
});

export type ConfirmNewCycleIncomeResult = ActionResult | undefined;

/**
 * Sets this quincena's actual paycheck amount, prompted right after closing
 * the previous cycle (rather than only editable via Profile) — pay varies
 * quincena to quincena, so this is asked every time instead of silently
 * reusing whatever was set last. Updates IncomeSource.netPayAmount too,
 * so it becomes the new baseline (and what the *next* prompt prefills).
 */
export const confirmNewCycleIncomeAction = withActionErrorHandling(async function confirmNewCycleIncomeAction(
  formData: FormData,
): Promise<ConfirmNewCycleIncomeResult> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;
  const t = getDictionary(await getRequestLocale());

  const parsed = decimalString.safeParse(formData.get("netPayAmount"));
  if (!parsed.success) {
    return { error: translateValidationMessage(parsed.error.issues[0]?.message ?? INVALID_AMOUNT_FORMAT_MESSAGE, t) };
  }
  const netPayAmount = parsed.data;

  const incomeSource = await getActiveIncomeSource(prisma, userId);
  if (!incomeSource) {
    return { error: t.dashboard.noIncomeSource };
  }

  const cycle = await getOrCreateDraftCycle(userId);

  await prisma.$transaction([
    prisma.incomeSource.update({ where: { id: incomeSource.id }, data: { netPayAmount } }),
    upsertCycleIncomeEntry(prisma, cycle.id, incomeSource.id, netPayAmount),
  ]);

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
    return { error: t.dashboard.quincenaNotFound(resolveVocab(t, await getUserPayFrequency(userId))) };
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

  const writes: Prisma.PrismaPromise<unknown>[] = [];
  if (cycle.status !== "CLOSED") {
    writes.push(
      prisma.incomeSource.update({
        where: { id: incomeSource.id },
        data: { netPayAmount: parsedAmount.data },
      }),
    );
  }
  writes.push(upsertCycleIncomeEntry(prisma, cycle.id, incomeSource.id, parsedAmount.data));
  writes.push(
    prisma.budgetCycle.update({
      where: { id: cycle.id },
      data: { periodStart: payDate, label: formatCycleLabel(payDate) },
    }),
  );

  if (assessment?.ok && assessment.changed && assessment.movingCount > 0 && assessment.moveRange) {
    const sourceForMoved = assessment.direction === "in" ? assessment.otherCycleId! : cycle.id;
    const targetForMoved = assessment.direction === "in" ? cycle.id : assessment.otherCycleId!;
    writes.push(
      prisma.cycleTransaction.updateMany({
        where: { cycleId: sourceForMoved, occurredAt: assessment.moveRange },
        data: { cycleId: targetForMoved },
      }),
    );
  }

  await prisma.$transaction(writes);

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
    return { ok: false, error: t.dashboard.quincenaNotFound(resolveVocab(t, await getUserPayFrequency(userId))) };
  }
  const newDate = parseDateOnly(newPayDateStr);
  if (!newDate) {
    return { ok: false, error: t.dashboard.editPayInfo.invalidDate };
  }

  return assessPayDateChange(userId, cycle, newDate, t.dashboard.editPayInfo);
});
