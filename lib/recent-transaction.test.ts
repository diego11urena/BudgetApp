import { randomUUID } from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "./prisma";
import { getMostRecentTransaction } from "./recent-transaction";

// Real-Postgres tests for getMostRecentTransaction -- same pattern as
// lib/recurring-expenses.test.ts (skipped unless DATABASE_URL is set).
describe.skipIf(!process.env.DATABASE_URL)("getMostRecentTransaction", () => {
  let userId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `recent-transaction-query-${randomUUID()}@example.test`,
        hashedPassword: "not-a-real-hash",
      },
    });
    userId = user.id;
  });

  afterEach(async () => {
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  });

  async function makeExpenseCategory(name: string) {
    return prisma.expenseCategory.create({ data: { userId, name, type: "EXPENSE" } });
  }

  // Only one DRAFT/ACTIVE cycle per user is allowed (a partial unique
  // index enforces it) -- a test spanning two cycles needs the older one
  // CLOSED, same as it would be for real once a new quincena starts.
  async function makeCycle(periodStart: Date, status: "ACTIVE" | "CLOSED" = "ACTIVE") {
    return prisma.budgetCycle.create({
      data: { userId, label: "test", periodStart, status },
    });
  }

  async function makeTransaction(
    cycleId: string,
    categoryId: string | null,
    occurredAt: Date,
    overrides: Partial<{ name: string; amount: number; type: "EXPENSE" | "INCOME" | "SAVINGS" }> = {},
  ) {
    return prisma.cycleTransaction.create({
      data: {
        cycleId,
        userId,
        type: overrides.type ?? "EXPENSE",
        name: overrides.name ?? "Coffee",
        amount: overrides.amount ?? 3.5,
        expenseCategoryId: categoryId,
        occurredAt,
      },
    });
  }

  it("returns null for a user with no transactions", async () => {
    expect(await getMostRecentTransaction(userId)).toBeNull();
  });

  it("returns the most recent transaction across cycles, not just the current one", async () => {
    const category = await makeExpenseCategory("Coffee");
    const oldCycle = await makeCycle(new Date(2026, 0, 1), "CLOSED");
    const newCycle = await makeCycle(new Date(2026, 0, 15));
    await makeTransaction(oldCycle.id, category.id, new Date(2026, 0, 3), { name: "Old coffee", amount: 2 });
    await makeTransaction(newCycle.id, category.id, new Date(2026, 0, 16), { name: "New coffee", amount: 4.25 });

    const result = await getMostRecentTransaction(userId);
    expect(result?.name).toBe("New coffee");
    expect(result?.amount).toBeCloseTo(4.25);
    expect(result?.categoryName).toBe("Coffee");
  });

  it("skips an uncategorized transaction, even if it's the most recent, in favor of the latest categorized one", async () => {
    const category = await makeExpenseCategory("Groceries");
    const cycle = await makeCycle(new Date(2026, 0, 1));
    await makeTransaction(cycle.id, category.id, new Date(2026, 0, 5), { name: "Groceries run" });
    await makeTransaction(cycle.id, null, new Date(2026, 0, 6), { name: "Unresolved import" });

    const result = await getMostRecentTransaction(userId);
    expect(result?.name).toBe("Groceries run");
  });

  it("carries the transaction's own type through, not always EXPENSE", async () => {
    const category = await prisma.expenseCategory.create({ data: { userId, name: "Rainy day", type: "SAVINGS" } });
    const cycle = await makeCycle(new Date(2026, 0, 1));
    await makeTransaction(cycle.id, category.id, new Date(2026, 0, 5), { type: "SAVINGS", amount: 50 });

    const result = await getMostRecentTransaction(userId);
    expect(result?.type).toBe("SAVINGS");
  });
});
