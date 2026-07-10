"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateDraftCycle } from "@/lib/cycles";
import { accountsStepSchema } from "@/lib/validations/onboarding";

export type AccountsFormState = { error?: string } | undefined;

const DEBT_TYPES = new Set(["CREDIT_CARD", "LOAN", "OTHER_DEBT"]);

export async function saveAccountsAction(
  _prevState: AccountsFormState,
  formData: FormData,
): Promise<AccountsFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  const userId = session.user.id;

  const raw = formData.get("accountsJson");
  let rawAccounts: unknown;
  try {
    rawAccounts = JSON.parse(typeof raw === "string" ? raw : "[]");
  } catch {
    return { error: "Invalid submission" };
  }

  const parsed = accountsStepSchema.safeParse({ accounts: rawAccounts });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const cycle = await getOrCreateDraftCycle(userId);

  await prisma.$transaction(async (tx) => {
    for (const item of parsed.data.accounts) {
      // Debts are entered as a positive magnitude, stored as a negative balance.
      const signedAmount = DEBT_TYPES.has(item.type) ? `-${item.amount}` : item.amount;

      const account = await tx.financialAccount.create({
        data: { userId, name: item.name, type: item.type },
      });

      await tx.cycleAccountBalance.create({
        data: {
          cycleId: cycle.id,
          financialAccountId: account.id,
          type: "OPENING",
          amount: signedAmount,
        },
      });
    }

    await tx.budgetCycle.update({
      where: { id: cycle.id },
      data: { status: "ACTIVE" },
    });

    await tx.user.update({
      where: { id: userId },
      data: { onboardingCompletedAt: new Date() },
    });
  });

  redirect("/dashboard");
}
