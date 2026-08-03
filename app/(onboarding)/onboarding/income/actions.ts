"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import { computeNetIncomeForCycle } from "@/lib/panama-tax";
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
    grossMonthlyAmount: formData.get("grossMonthlyAmount"),
    isPanamaPayroll: formData.get("isPanamaPayroll") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { name, grossMonthlyAmount, isPanamaPayroll } = parsed.data;

  const cycle = await getOrCreateDraftCycle(userId);

  // Server-side recompute — never trust a client-submitted net amount.
  const breakdown = computeNetIncomeForCycle({
    grossMonthlyAmount,
    isPanamaPayroll,
  });

  // Onboarding only supports one income source per user. Look up by userId
  // (not just this cycle's CycleIncomeEntry) so a brand-new cycle that
  // hasn't gotten its own entry yet — e.g. right after "I just got paid",
  // or after the dev reset tool deletes a cycle but leaves IncomeSource
  // rows alone — reuses the existing source instead of quietly creating a
  // second one that every downstream findFirst({ orderBy: createdAt: "asc" })
  // would then never pick up. A cycle is one quincena, so the quincena
  // breakdown is what's stored on its CycleIncomeEntry — never the monthly
  // figures.
  const [existingIncomeSource, existingEntry] = await Promise.all([
    prisma.incomeSource.findFirst({
      where: { userId, isActive: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.cycleIncomeEntry.findFirst({ where: { cycleId: cycle.id } }),
  ]);

  const entryData = {
    grossAmount: breakdown.grossQuincenaAmount,
    cssDeduction: breakdown.quincenaCssDeduction,
    seguroEducativoDeduction: breakdown.quincenaSeguroEducativoDeduction,
    isrDeduction: breakdown.quincenaIsrDeduction,
    netAmount: breakdown.netQuincenaAmount,
  };

  if (existingIncomeSource) {
    await prisma.$transaction([
      prisma.incomeSource.update({
        where: { id: existingIncomeSource.id },
        data: { name, grossMonthlyAmount, isPanamaPayroll },
      }),
      existingEntry
        ? prisma.cycleIncomeEntry.update({ where: { id: existingEntry.id }, data: entryData })
        : prisma.cycleIncomeEntry.create({
            data: { cycleId: cycle.id, incomeSourceId: existingIncomeSource.id, ...entryData },
          }),
    ]);
  } else {
    const incomeSource = await prisma.incomeSource.create({
      data: { userId, name, grossMonthlyAmount, isPanamaPayroll },
    });

    await prisma.cycleIncomeEntry.create({
      data: { cycleId: cycle.id, incomeSourceId: incomeSource.id, ...entryData },
    });
  }

  redirect("/onboarding/expenses");
}
