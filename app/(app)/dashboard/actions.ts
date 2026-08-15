"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  closeCycleAndStartNext,
  getActiveIncomeSource,
  getOrCreateDraftCycle,
  parsePayDate,
  upsertCycleIncomeEntry,
} from "@/lib/cycles";
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

/** How far back "Edit" (correcting an already-recorded pay date, possibly
 * days into an already-running quincena) allows — deliberately wider than
 * PAY_DATE_LOOKBACK_DAYS (7), since it must always be able to re-select the
 * cycle's own current periodStart, which can be up to a full quincena old. */
const EDIT_PAY_DATE_LOOKBACK_DAYS = 30;

export type EditPayInfoResult = { error?: string } | undefined;

/**
 * "Edit" on the Home hero card — corrects the CURRENT cycle's already-
 * recorded pay amount and/or pay date in place, as opposed to "I just got
 * paid" which always closes the cycle and starts a new one. Updates
 * IncomeSource.netQuincenaAmount too, same as confirmNewCycleIncomeAction,
 * so the correction becomes the new baseline. Recalculating Available to
 * spend/days remaining/etc. falls out for free: they're all derived live
 * from the cycle's stored periodStart/income on every render.
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
  const todayStart = nowInPanama();
  const earliest = new Date(todayStart);
  earliest.setDate(earliest.getDate() - EDIT_PAY_DATE_LOOKBACK_DAYS);
  if (payDate.getTime() > todayStart.getTime() || payDate.getTime() < earliest.getTime()) {
    return { error: "Date must be within the last 30 days and not in the future" };
  }

  const incomeSource = await getActiveIncomeSource(prisma, userId);
  if (!incomeSource) {
    return { error: "No income source found yet — complete onboarding first." };
  }

  const cycle = await getOrCreateDraftCycle(userId);

  await prisma.$transaction([
    prisma.incomeSource.update({
      where: { id: incomeSource.id },
      data: { netQuincenaAmount: parsedAmount.data },
    }),
    upsertCycleIncomeEntry(prisma, cycle.id, incomeSource.id, parsedAmount.data),
    prisma.budgetCycle.update({
      where: { id: cycle.id },
      data: { periodStart: payDate, label: formatCycleLabel(payDate) },
    }),
  ]);

  revalidateAppPages();
}
