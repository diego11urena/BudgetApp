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
    cycleMonth: cycle.periodStart.getMonth() + 1,
    isPanamaPayroll,
  });

  // Onboarding only supports one income source per cycle. If the user came
  // back to edit this step, update the existing rows in place instead of
  // creating a duplicate income source/entry.
  const existingEntry = await prisma.cycleIncomeEntry.findFirst({
    where: { cycleId: cycle.id },
  });

  const entryData = {
    grossAmount: breakdown.grossAmount,
    cssDeduction: breakdown.cssDeduction,
    seguroEducativoDeduction: breakdown.seguroEducativoDeduction,
    isrDeduction: breakdown.isrDeduction,
    decimoGrossAmount: breakdown.decimoGrossAmount,
    decimoCssDeduction: breakdown.decimoCssDeduction,
    decimoIsEstimated: breakdown.decimoIsEstimated,
    netAmount: breakdown.netAmount,
  };

  if (existingEntry?.incomeSourceId) {
    await prisma.$transaction([
      prisma.incomeSource.update({
        where: { id: existingEntry.incomeSourceId },
        data: { name, grossMonthlyAmount, isPanamaPayroll },
      }),
      prisma.cycleIncomeEntry.update({
        where: { id: existingEntry.id },
        data: entryData,
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
