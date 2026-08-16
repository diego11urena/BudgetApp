"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  assessPayDateChange,
  closeCycleAndStartNext,
  getActiveIncomeSource,
  getOrCreateDraftCycle,
  parsePayDate,
  upsertCycleIncomeEntry,
  type PayDateChangeResult,
} from "@/lib/cycles";
import type { Prisma } from "@/app/generated/prisma/client";
import { formatCycleLabel, nowInPanama, parseDateOnly } from "@/lib/pay-date";
import { getCycleBudgetGoals } from "@/lib/budget-goals";
import { decimalString, INVALID_AMOUNT_FORMAT_MESSAGE } from "@/lib/validations/shared";
import { revalidateAppPages } from "@/lib/revalidate";

export interface CycleClosedSummary {
  spent: number;
  saved: number;
  /** Income minus expenses minus savings — what's left from that quincena. */
  rolledOver: number;
  topCategory: { name: string; amount: number } | null;
  budget: { hasBudget: boolean; overBy: number };
  /** The amount auto-carried into the new cycle — prefills the "how much did you get paid?" prompt. */
  carriedIncomeAmount: number;
}

/**
 * payDateStr is the "When did you get paid?" date input's value
 * ("YYYY-MM-DD"). An invalid/out-of-range value (the field's own min/max
 * already constrain this client-side; this is the server-side backstop)
 * falls back to today rather than failing the whole close-cycle action.
 */
export async function justGotPaidAction(payDateStr?: string): Promise<CycleClosedSummary> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const payDate = (payDateStr && parsePayDate(payDateStr)) || nowInPanama();

  const { closedCycle, newCycle, closedCycleFinancials } = await closeCycleAndStartNext(
    session.user.id,
    payDate,
  );
  const [goals, carriedEntry] = await Promise.all([
    getCycleBudgetGoals(closedCycle.id, "EXPENSE"),
    prisma.cycleIncomeEntry.findFirst({ where: { cycleId: newCycle.id } }),
  ]);
  const totalBudget = goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
  const top = closedCycleFinancials.topCategories[0];

  revalidateAppPages();

  return {
    spent: closedCycleFinancials.totalExpenses,
    saved: closedCycleFinancials.totalSavings,
    rolledOver: closedCycleFinancials.amountLeft,
    topCategory: top ? { name: top.categoryName, amount: top.amount } : null,
    budget: {
      hasBudget: goals.length > 0,
      overBy: Math.max(closedCycleFinancials.totalExpenses - totalBudget, 0),
    },
    carriedIncomeAmount: carriedEntry?.netAmount.toNumber() ?? 0,
  };
}

export type ConfirmNewCycleIncomeResult = { error?: string } | undefined;

/**
 * Sets this quincena's actual paycheck amount, prompted right after closing
 * the previous cycle (rather than only editable via Profile) — pay varies
 * quincena to quincena, so this is asked every time instead of silently
 * reusing whatever was set last. Updates IncomeSource.netQuincenaAmount too,
 * so it becomes the new baseline (and what the *next* prompt prefills).
 */
export async function confirmNewCycleIncomeAction(
  formData: FormData,
): Promise<ConfirmNewCycleIncomeResult> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const parsed = decimalString.safeParse(formData.get("netQuincenaAmount"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? INVALID_AMOUNT_FORMAT_MESSAGE };
  }
  const netQuincenaAmount = parsed.data;

  const incomeSource = await getActiveIncomeSource(prisma, userId);
  if (!incomeSource) {
    return { error: "No income source found yet — complete onboarding first." };
  }

  const cycle = await getOrCreateDraftCycle(userId);

  await prisma.$transaction([
    prisma.incomeSource.update({ where: { id: incomeSource.id }, data: { netQuincenaAmount } }),
    upsertCycleIncomeEntry(prisma, cycle.id, incomeSource.id, netQuincenaAmount),
  ]);

  revalidateAppPages();
}

export type EditPayInfoResult = { error?: string } | undefined;

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
 * also updates IncomeSource.netQuincenaAmount, so the correction becomes
 * the new baseline for future cycles. On a CLOSED cycle, that baseline is
 * left alone — only the currently-open cycle's edits should change what
 * prefills the *next* cycle's income prompt.
 */
export async function editCyclePayInfoAction(formData: FormData): Promise<EditPayInfoResult> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const parsedAmount = decimalString.safeParse(formData.get("netQuincenaAmount"));
  if (!parsedAmount.success) {
    return { error: parsedAmount.error.issues[0]?.message ?? INVALID_AMOUNT_FORMAT_MESSAGE };
  }

  const payDateStr = formData.get("payDate");
  if (typeof payDateStr !== "string" || !payDateStr) {
    return { error: "Date is required" };
  }
  const payDate = parseDateOnly(payDateStr);
  if (!payDate) {
    return { error: "Invalid date" };
  }

  const hintedCycleId = formData.get("cycleId");
  const cycle =
    typeof hintedCycleId === "string" && hintedCycleId
      ? await prisma.budgetCycle.findFirst({ where: { id: hintedCycleId, userId } })
      : await getOrCreateDraftCycle(userId);
  if (!cycle) {
    return { error: "Quincena not found" };
  }

  let assessment: PayDateChangeResult | null = null;
  const payDateChanging = payDate.getTime() !== cycle.periodStart.getTime();

  if (payDateChanging) {
    if (cycle.status !== "CLOSED" && payDate.getTime() > nowInPanama().getTime()) {
      return { error: "Date must not be in the future" };
    }
    assessment = await assessPayDateChange(userId, cycle, payDate);
    if (!assessment.ok) {
      return { error: assessment.error };
    }
  }

  const incomeSource = await getActiveIncomeSource(prisma, userId);
  if (!incomeSource) {
    return { error: "No income source found yet — complete onboarding first." };
  }

  const writes: Prisma.PrismaPromise<unknown>[] = [];
  if (cycle.status !== "CLOSED") {
    writes.push(
      prisma.incomeSource.update({
        where: { id: incomeSource.id },
        data: { netQuincenaAmount: parsedAmount.data },
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
}

/**
 * Read-only preview for a past cycle's pay-date edit — how many
 * transactions would move, and which quincena they'd move to/from, before
 * the user confirms. Shares assessPayDateChange with the actual commit
 * (editCyclePayInfoAction) so this can never show a different outcome than
 * what saving actually does.
 */
export async function previewPayDateChangeAction(
  cycleId: string,
  newPayDateStr: string,
): Promise<PayDateChangeResult> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const cycle = await prisma.budgetCycle.findFirst({ where: { id: cycleId, userId } });
  if (!cycle) {
    return { ok: false, error: "Quincena not found" };
  }
  const newDate = parseDateOnly(newPayDateStr);
  if (!newDate) {
    return { ok: false, error: "Invalid date" };
  }

  return assessPayDateChange(userId, cycle, newDate);
}
