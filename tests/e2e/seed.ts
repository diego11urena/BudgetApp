/**
 * General E2E seeding for states with no quick UI path (dated charges,
 * Gmail imports, past cycles). Runs as its own tsx process for the same
 * reason as seed-transaction.ts. Dates are given as days before today.
 */
import { prisma } from "@/lib/prisma";
import { addDays, nowInPanama, startOfDay } from "@/lib/pay-date";
import { getOrCreateCategory } from "@/lib/categories";

interface SeedTransaction {
  name: string;
  amount: number;
  daysAgo?: number;
  type?: "EXPENSE" | "INCOME" | "SAVINGS";
  category?: string;
  importSource?: "MANUAL" | "GMAIL";
  /** Links it to this recurring expense (by name). */
  recurring?: string;
}

interface SeedPayload {
  email: string;
  /** Moves the current cycle's start back this many days. */
  cycleStartDaysAgo?: number;
  recurring?: { name: string; amount: number; dueDay?: number | null; category?: string }[];
  transactions?: SeedTransaction[];
  /** Closed cycles before the current one, oldest first, each with its own transactions. */
  closedCycles?: { startDaysAgo: number; endDaysAgo: number; income?: number; transactions?: SeedTransaction[] }[];
}

async function main() {
  const p = JSON.parse(process.argv[2]) as SeedPayload;
  const user = await prisma.user.findUniqueOrThrow({ where: { email: p.email } });
  const today = startOfDay(nowInPanama());
  const cycle = await prisma.budgetCycle.findFirstOrThrow({ where: { userId: user.id, status: { in: ["DRAFT", "ACTIVE"] } } });

  if (p.cycleStartDaysAgo !== undefined) {
    await prisma.budgetCycle.update({ where: { id: cycle.id }, data: { periodStart: addDays(today, -p.cycleStartDaysAgo) } });
  }

  const recurringIds = new Map<string, string>();
  for (const r of p.recurring ?? []) {
    const category = await getOrCreateCategory(prisma, user.id, r.category ?? r.name, "EXPENSE");
    const created = await prisma.recurringExpense.create({
      data: { userId: user.id, categoryId: category.id, name: r.name, amount: r.amount, dueDay: r.dueDay ?? null },
    });
    await prisma.cycleRecurringExpense.create({ data: { cycleId: cycle.id, recurringExpenseId: created.id, targetAmount: r.amount } });
    recurringIds.set(r.name, created.id);
  }

  async function addTransaction(cycleId: string, t: SeedTransaction) {
    const type = t.type ?? "EXPENSE";
    const category = t.category ? await getOrCreateCategory(prisma, user.id, t.category, type) : null;
    await prisma.cycleTransaction.create({
      data: {
        cycleId,
        userId: user.id,
        type,
        name: t.name,
        amount: t.amount,
        occurredAt: addDays(today, -(t.daysAgo ?? 0)),
        expenseCategoryId: category?.id ?? null,
        importSource: t.importSource ?? "MANUAL",
        sourceMessageId: t.importSource === "GMAIL" ? `seed-${Math.random().toString(36).slice(2)}` : null,
        recurringExpenseId: t.recurring ? (recurringIds.get(t.recurring) ?? null) : null,
      },
    });
  }

  for (const c of p.closedCycles ?? []) {
    const closed = await prisma.budgetCycle.create({
      data: {
        userId: user.id,
        label: "seed",
        status: "CLOSED",
        periodStart: addDays(today, -c.startDaysAgo),
        periodEnd: addDays(today, -c.endDaysAgo),
      },
    });
    if (c.income) await prisma.cycleIncomeEntry.create({ data: { cycleId: closed.id, netAmount: c.income } });
    for (const t of c.transactions ?? []) await addTransaction(closed.id, t);
  }

  for (const t of p.transactions ?? []) await addTransaction(cycle.id, t);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
