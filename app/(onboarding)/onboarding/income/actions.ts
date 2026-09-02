"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveIncomeSource, getOrCreateDraftCycle, upsertCycleIncomeEntry } from "@/lib/cycles";
import { incomeStepSchema } from "@/lib/validations/onboarding";
import { isUniqueConstraintViolation } from "@/lib/prisma-errors";
import type { ActionResult } from "@/lib/action-error";
import { getRequestLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { translateValidationMessage } from "@/lib/i18n/translate-validation-message";

export type IncomeFormState = ActionResult | undefined;

export async function saveIncomeAction(
  _prevState: IncomeFormState,
  formData: FormData,
): Promise<IncomeFormState> {
  const t = getDictionary(await getRequestLocale());

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const parsed = incomeStepSchema.safeParse({
    netQuincenaAmount: formData.get("netQuincenaAmount"),
  });

  if (!parsed.success) {
    return { error: translateValidationMessage(parsed.error.issues[0]?.message ?? "", t) || t.common.invalidInput };
  }

  const { netQuincenaAmount } = parsed.data;

  const cycle = await getOrCreateDraftCycle(userId);

  // Onboarding only supports one income source per user. Look up by userId
  // (not just this cycle's CycleIncomeEntry) so a brand-new cycle that
  // hasn't gotten its own entry yet — e.g. right after "I just got paid",
  // or after the dev reset tool deletes a cycle but leaves IncomeSource
  // rows alone — reuses the existing source instead of quietly creating a
  // second one that every downstream getActiveIncomeSource would then
  // never pick up.
  let incomeSource = await getActiveIncomeSource(prisma, userId);

  if (!incomeSource) {
    try {
      incomeSource = await prisma.incomeSource.create({ data: { userId, netQuincenaAmount } });
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
      // Lost the race to a concurrent submit that also found no existing
      // source — the partial unique index on (userId) WHERE isActive
      // guarantees exactly one winner. Fall through and treat it like any
      // other already-existing income source below.
      incomeSource = await getActiveIncomeSource(prisma, userId);
      if (!incomeSource) throw error;
    }
  }

  await prisma.$transaction([
    prisma.incomeSource.update({
      where: { id: incomeSource.id },
      data: { netQuincenaAmount },
    }),
    upsertCycleIncomeEntry(prisma, cycle.id, incomeSource.id, netQuincenaAmount),
  ]);

  redirect("/onboarding/expenses");
}
