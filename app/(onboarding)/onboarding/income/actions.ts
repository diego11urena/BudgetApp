"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import { incomeStepSchema } from "@/lib/validations/onboarding";
import { isUniqueConstraintViolation } from "@/lib/prisma-errors";

export type IncomeFormState = { error?: string } | undefined;

export async function saveIncomeAction(
  _prevState: IncomeFormState,
  formData: FormData,
): Promise<IncomeFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  // There's only ever one income source and it's always a biweekly
  // paycheck — no need to ask for a name. Profile still allows renaming it
  // afterward for anyone who wants to.
  const parsed = incomeStepSchema.safeParse({
    name: "Paycheck",
    netQuincenaAmount: formData.get("netQuincenaAmount"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { name, netQuincenaAmount } = parsed.data;

  const cycle = await getOrCreateDraftCycle(userId);

  // Onboarding only supports one income source per user. Look up by userId
  // (not just this cycle's CycleIncomeEntry) so a brand-new cycle that
  // hasn't gotten its own entry yet — e.g. right after "I just got paid",
  // or after the dev reset tool deletes a cycle but leaves IncomeSource
  // rows alone — reuses the existing source instead of quietly creating a
  // second one that every downstream findFirst({ orderBy: createdAt: "asc" })
  // would then never pick up.
  const findActiveIncomeSource = () =>
    prisma.incomeSource.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: "asc" },
    });

  let incomeSource = await findActiveIncomeSource();

  if (!incomeSource) {
    try {
      incomeSource = await prisma.incomeSource.create({ data: { userId, name, netQuincenaAmount } });
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
      // Lost the race to a concurrent submit that also found no existing
      // source — the partial unique index on (userId) WHERE isActive
      // guarantees exactly one winner. Fall through and treat it like any
      // other already-existing income source below.
      incomeSource = await findActiveIncomeSource();
      if (!incomeSource) throw error;
    }
  }

  const existingEntry = await prisma.cycleIncomeEntry.findFirst({ where: { cycleId: cycle.id } });

  await prisma.$transaction([
    prisma.incomeSource.update({
      where: { id: incomeSource.id },
      data: { name, netQuincenaAmount },
    }),
    existingEntry
      ? prisma.cycleIncomeEntry.update({
          where: { id: existingEntry.id },
          data: { netAmount: netQuincenaAmount },
        })
      : prisma.cycleIncomeEntry.create({
          data: { cycleId: cycle.id, incomeSourceId: incomeSource.id, netAmount: netQuincenaAmount },
        }),
  ]);

  redirect("/onboarding/expenses");
}
