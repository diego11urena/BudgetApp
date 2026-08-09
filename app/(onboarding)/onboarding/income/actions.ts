"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import { incomeStepSchema } from "@/lib/validations/onboarding";

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

  const parsed = incomeStepSchema.safeParse({
    name: formData.get("name"),
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
  const [existingIncomeSource, existingEntry] = await Promise.all([
    prisma.incomeSource.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.cycleIncomeEntry.findFirst({ where: { cycleId: cycle.id } }),
  ]);

  if (existingIncomeSource) {
    await prisma.$transaction([
      prisma.incomeSource.update({
        where: { id: existingIncomeSource.id },
        data: { name, netQuincenaAmount },
      }),
      existingEntry
        ? prisma.cycleIncomeEntry.update({
            where: { id: existingEntry.id },
            data: { netAmount: netQuincenaAmount },
          })
        : prisma.cycleIncomeEntry.create({
            data: {
              cycleId: cycle.id,
              incomeSourceId: existingIncomeSource.id,
              netAmount: netQuincenaAmount,
            },
          }),
    ]);
  } else {
    const incomeSource = await prisma.incomeSource.create({
      data: { userId, name, netQuincenaAmount },
    });

    await prisma.cycleIncomeEntry.create({
      data: { cycleId: cycle.id, incomeSourceId: incomeSource.id, netAmount: netQuincenaAmount },
    });
  }

  redirect("/onboarding/expenses");
}
