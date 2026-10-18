/**
 * Seeds one CycleTransaction directly via Prisma, for E2E scenarios with no
 * UI path to reach them -- e.g. a transaction missing a category, which
 * only ever happens via Gmail import (the manual Add Transaction form
 * always requires one). Run as its own tsx process (see
 * dashboard-banners.spec.ts) rather than imported into a Playwright test
 * file directly: Playwright's test-file loader can't handle the
 * Prisma-generated client's import.meta usage, but a real separate tsx
 * process (same pattern as `npm run db:seed`) has no such restriction.
 */
import { prisma } from "@/lib/prisma";

async function main() {
  const payload = JSON.parse(process.argv[2]) as {
    email: string;
    name: string;
    amount: number;
    type?: "EXPENSE" | "INCOME" | "SAVINGS";
    paymentMethod?: "CASH" | "CREDIT_CARD" | "DEBIT_CARD" | "YAPPY" | "ACH";
    description?: string | null;
  };

  const user = await prisma.user.findUniqueOrThrow({ where: { email: payload.email } });
  const cycle = await prisma.budgetCycle.findFirstOrThrow({ where: { userId: user.id } });

  await prisma.cycleTransaction.create({
    data: {
      cycleId: cycle.id,
      userId: user.id,
      type: payload.type ?? "EXPENSE",
      name: payload.name,
      amount: payload.amount,
      paymentMethod: payload.paymentMethod ?? null,
      expenseCategoryId: null,
      description: payload.description ?? null,
    },
  });
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
